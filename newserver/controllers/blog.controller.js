// controllers/blog.controller.js

const pool = require('../pool/pool');
const userpool = require('../pool/userpool'); // Importing the userpool for user-related data

// ---------------------
// Helper Functions
// ---------------------

/**
 * Fetch user information from userpool based on an array of user IDs.
 * @param {Array<number>} userIds - Array of user IDs.
 * @returns {Object} - Mapping of user_id to username.
 */
const getUsernames = async (userIds) => {
    if (userIds.length === 0) return {};

    const placeholders = userIds.map(() => '?').join(', ');
    const query = `SELECT user_id, username FROM users WHERE user_id IN (${placeholders})`;

    try {
        const [users] = await userpool.query(query, userIds);
        const userMap = {};
        users.forEach(user => {
            userMap[user.user_id] = user.username;
        });
        return userMap;
    } catch (err) {
        console.error('Error fetching usernames from userpool:', err);
        throw err;
    }
};

// ---------------------
// Blog Posts
// ---------------------

// Get all blog posts with associated categories, tags, and comment count
exports.getAllPosts = async (req, res) => {
    try {
        // Fetch all blog posts with comment count
        const postsQuery = `
            SELECT bp.id, bp.user_id, bp.title, bp.content, bp.status, bp.created_at, bp.updated_at,
                   (SELECT COUNT(*) FROM blog_comments bc WHERE bc.post_id = bp.id) AS commentCount
            FROM blog_posts bp
            ORDER BY bp.created_at DESC
        `;
        const [posts] = await pool.query(postsQuery);

        if (posts.length === 0) {
            return res.status(200).json({ posts: [] });
        }

        // Extract unique user_ids from posts
        const userIds = [...new Set(posts.map(post => post.user_id))];

        // Fetch usernames from userpool
        const userMap = await getUsernames(userIds);

        // Map posts with usernames
        const enrichedPosts = await Promise.all(posts.map(async (post) => {
            // Fetch categories
            const categoriesQuery = `
                SELECT bc.id, bc.name
                FROM post_categories pc
                JOIN blog_categories bc ON pc.category_id = bc.id
                WHERE pc.post_id = ?
            `;
            const [categories] = await pool.query(categoriesQuery, [post.id]);

            // Fetch tags
            const tagsQuery = `
                SELECT bt.id, bt.name
                FROM post_tags pt
                JOIN blog_tags bt ON pt.tag_id = bt.id
                WHERE pt.post_id = ?
            `;
            const [tags] = await pool.query(tagsQuery, [post.id]);

            return {
                ...post,
                author: userMap[post.user_id] || 'Unknown',
                categories,
                tags
            };
        }));

        res.status(200).json({ posts: enrichedPosts });
    } catch (err) {
        console.error('Error fetching blog posts:', err);
        res.status(500).json({ message: 'Error fetching blog posts', error: err.message });
    }
};

// Get a specific blog post by ID with associated categories and tags
exports.getPostById = async (req, res) => {
    const { id } = req.params;

    try {
        // Fetch the blog post
        const postQuery = `
            SELECT bp.id, bp.user_id, bp.title, bp.content, bp.status, bp.created_at, bp.updated_at,
                   (SELECT COUNT(*) FROM blog_comments bc WHERE bc.post_id = bp.id) AS commentCount
            FROM blog_posts bp
            WHERE bp.id = ?
        `;
        const [posts] = await pool.query(postQuery, [id]);

        if (posts.length === 0) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const post = posts[0];

        // Fetch author username from userpool
        const [user] = await userpool.query('SELECT username FROM users WHERE user_id = ?', [post.user_id]);
        const author = user.length > 0 ? user[0].username : 'Unknown';

        // Fetch categories
        const categoriesQuery = `
            SELECT bc.id, bc.name
            FROM post_categories pc
            JOIN blog_categories bc ON pc.category_id = bc.id
            WHERE pc.post_id = ?
        `;
        const [categories] = await pool.query(categoriesQuery, [id]);

        // Fetch tags
        const tagsQuery = `
            SELECT bt.id, bt.name
            FROM post_tags pt
            JOIN blog_tags bt ON pt.tag_id = bt.id
            WHERE pt.post_id = ?
        `;
        const [tags] = await pool.query(tagsQuery, [id]);

        res.status(200).json({
            post: {
                ...post,
                author,
                categories,
                tags
            }
        });
    } catch (err) {
        console.error('Error fetching the blog post:', err);
        res.status(500).json({ message: 'Error fetching the blog post', error: err.message });
    }
};

// Create a new blog post
exports.createPost = async (req, res) => {
    const { title, content, status } = req.body;
    const userId = req.user.id; // Assuming user ID is available from authentication middleware

    try {
        // Insert the new blog post
        const insertQuery = `
            INSERT INTO blog_posts (user_id, title, content, status)
            VALUES (?, ?, ?, ?)
        `;
        const [result] = await pool.query(insertQuery, [userId, title, content, status || 'draft']);
        const insertedId = result.insertId;

        // Fetch the newly created post
        const postQuery = `
            SELECT bp.id, bp.user_id, bp.title, bp.content, bp.status, bp.created_at, bp.updated_at,
                   (SELECT COUNT(*) FROM blog_comments bc WHERE bc.post_id = bp.id) AS commentCount
            FROM blog_posts bp
            WHERE bp.id = ?
        `;
        const [posts] = await pool.query(postQuery, [insertedId]);

        const post = posts[0];

        // Fetch author username from userpool
        const [user] = await userpool.query('SELECT username FROM users WHERE user_id = ?', [post.user_id]);
        const author = user.length > 0 ? user[0].username : 'Unknown';

        res.status(201).json({
            message: 'Blog post created successfully',
            post: {
                ...post,
                author,
                categories: [],
                tags: []
            }
        });
    } catch (err) {
        console.error('Error creating blog post:', err);
        res.status(500).json({ message: 'Error creating blog post', error: err.message });
    }
};

// Update a blog post
exports.updatePost = async (req, res) => {
    const { id } = req.params;
    const { title, content, status } = req.body;
    const userId = req.user.id; // Assuming user ID is available from authentication middleware

    try {
        // Update the blog post
        const updateQuery = `
            UPDATE blog_posts
            SET title = ?, content = ?, status = ?, updated_at = NOW()
            WHERE id = ? AND user_id = ?
        `;
        const [result] = await pool.query(updateQuery, [title, content, status, id, userId]);

        if (result.affectedRows === 0) {
            return res.status(403).json({ message: 'You do not have permission to update this post or post not found' });
        }

        res.status(200).json({ message: 'Blog post updated successfully' });
    } catch (err) {
        console.error('Error updating blog post:', err);
        res.status(500).json({ message: 'Error updating blog post', error: err.message });
    }
};

// Delete a blog post
exports.deletePost = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id; // Assuming user ID is available from authentication middleware

    try {
        // Delete the blog post
        const deleteQuery = `
            DELETE FROM blog_posts
            WHERE id = ? AND user_id = ?
        `;
        const [result] = await pool.query(deleteQuery, [id, userId]);

        if (result.affectedRows === 0) {
            return res.status(403).json({ message: 'You do not have permission to delete this post or post not found' });
        }

        res.status(200).json({ message: 'Blog post deleted successfully' });
    } catch (err) {
        console.error('Error deleting blog post:', err);
        res.status(500).json({ message: 'Error deleting blog post', error: err.message });
    }
};

// ---------------------
// Blog Comments
// ---------------------

// Get all comments for a specific blog post
exports.getCommentsByPostId = async (req, res) => {
    const { postId } = req.params;

    try {
        // Fetch all comments for the post
        const commentsQuery = `
            SELECT bc.id, bc.post_id, bc.user_id, bc.author_name, bc.author_email, bc.content, bc.created_at, bc.updated_at
            FROM blog_comments bc
            WHERE bc.post_id = ?
            ORDER BY bc.created_at ASC
        `;
        const [comments] = await pool.query(commentsQuery, [postId]);

        if (comments.length === 0) {
            return res.status(200).json({ comments: [] });
        }

        // Extract unique user_ids from comments (excluding nulls)
        const userIds = [...new Set(comments.filter(comment => comment.user_id !== null).map(comment => comment.user_id))];

        // Fetch usernames from userpool
        const userMap = await getUsernames(userIds);

        // Map comments with usernames
        const enrichedComments = comments.map(comment => ({
            ...comment,
            author: comment.user_id ? (userMap[comment.user_id] || 'Unknown') : comment.author_name
        }));

        res.status(200).json({ comments: enrichedComments });
    } catch (err) {
        console.error('Error fetching comments:', err);
        res.status(500).json({ message: 'Error fetching comments', error: err.message });
    }
};

// Create a comment for a specific blog post
exports.createComment = async (req, res) => {
    const { postId } = req.params;
    const { content, author_name, author_email } = req.body;
    const userId = req.user ? req.user.id : null; // User ID if authenticated, null for guest

    // Validate guest comment fields if user is not authenticated
    if (!userId) {
        if (!author_name || !author_email) {
            return res.status(400).json({ message: 'Author name and email are required for guest comments.' });
        }
    }

    try {
        // Insert the new comment
        const insertQuery = `
            INSERT INTO blog_comments (post_id, user_id, author_name, author_email, content)
            VALUES (?, ?, ?, ?, ?)
        `;
        const [result] = await pool.query(insertQuery, [
            postId,
            userId,
            userId ? null : author_name,
            userId ? null : author_email,
            content
        ]);

        res.status(201).json({ message: 'Comment added successfully', commentId: result.insertId });
    } catch (err) {
        console.error('Error adding comment:', err);
        res.status(500).json({ message: 'Error adding comment', error: err.message });
    }
};

// ---------------------
// Blog Categories
// ---------------------

// Get all categories
exports.getAllCategories = async (req, res) => {
    try {
        const [categories] = await pool.query('SELECT * FROM blog_categories ORDER BY name ASC');
        res.status(200).json({ categories });
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({ message: 'Error fetching categories', error: err.message });
    }
};

// Get a single category by ID
exports.getCategoryById = async (req, res) => {
    const { id } = req.params;

    try {
        const [categories] = await pool.query('SELECT * FROM blog_categories WHERE id = ?', [id]);

        if (categories.length === 0) {
            return res.status(404).json({ message: 'Category not found.' });
        }

        res.status(200).json({ category: categories[0] });
    } catch (err) {
        console.error('Error fetching category:', err);
        res.status(500).json({ message: 'Error fetching category', error: err.message });
    }
};

// Create a new category
exports.createCategory = async (req, res) => {
    const { name } = req.body;

    try {
        const [result] = await pool.query('INSERT INTO blog_categories (name) VALUES (?)', [name]);
        res.status(201).json({ message: 'Category created successfully', categoryId: result.insertId });
    } catch (err) {
        console.error('Error creating category:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Category name must be unique.' });
        }
        res.status(500).json({ message: 'Error creating category', error: err.message });
    }
};

// Update a category
exports.updateCategory = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    try {
        const [result] = await pool.query('UPDATE blog_categories SET name = ? WHERE id = ?', [name, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Category not found.' });
        }

        res.status(200).json({ message: 'Category updated successfully.' });
    } catch (err) {
        console.error('Error updating category:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Category name must be unique.' });
        }
        res.status(500).json({ message: 'Error updating category', error: err.message });
    }
};

// ---------------------
// Blog Tags
// ---------------------

// Get all tags
exports.getAllTags = async (req, res) => {
    try {
        const [tags] = await pool.query('SELECT * FROM blog_tags ORDER BY name ASC');
        res.status(200).json({ tags });
    } catch (err) {
        console.error('Error fetching tags:', err);
        res.status(500).json({ message: 'Error fetching tags', error: err.message });
    }
};

// Get a single tag by ID
exports.getTagById = async (req, res) => {
    const { id } = req.params;

    try {
        const [tags] = await pool.query('SELECT * FROM blog_tags WHERE id = ?', [id]);

        if (tags.length === 0) {
            return res.status(404).json({ message: 'Tag not found.' });
        }

        res.status(200).json({ tag: tags[0] });
    } catch (err) {
        console.error('Error fetching tag:', err);
        res.status(500).json({ message: 'Error fetching tag', error: err.message });
    }
};

// Create a new tag
exports.createTag = async (req, res) => {
    const { name } = req.body;

    try {
        const [result] = await pool.query('INSERT INTO blog_tags (name) VALUES (?)', [name]);
        res.status(201).json({ message: 'Tag created successfully', tagId: result.insertId });
    } catch (err) {
        console.error('Error creating tag:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Tag name must be unique.' });
        }
        res.status(500).json({ message: 'Error creating tag', error: err.message });
    }
};

// Update a tag
exports.updateTag = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    try {
        const [result] = await pool.query('UPDATE blog_tags SET name = ? WHERE id = ?', [name, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Tag not found.' });
        }

        res.status(200).json({ message: 'Tag updated successfully.' });
    } catch (err) {
        console.error('Error updating tag:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Tag name must be unique.' });
        }
        res.status(500).json({ message: 'Error updating tag', error: err.message });
    }
};

// ---------------------
// Assign Categories to a Post
// ---------------------

exports.assignCategoriesToPost = async (req, res) => {
    const { postId } = req.params;
    const { categoryIds } = req.body; // Expecting an array of category IDs

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
        return res.status(400).json({ message: 'categoryIds must be a non-empty array.' });
    }

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Delete existing category assignments for the post
        await connection.query('DELETE FROM post_categories WHERE post_id = ?', [postId]);

        // Prepare values for bulk insert
        const values = categoryIds.map((categoryId) => [postId, categoryId]);

        // Insert new category assignments
        await connection.query('INSERT INTO post_categories (post_id, category_id) VALUES ?', [values]);

        // Commit the transaction
        await connection.commit();
        res.status(200).json({ message: 'Categories assigned successfully' });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Error assigning categories:', err);
        res.status(500).json({ message: 'Error assigning categories', error: err.message });
    } finally {
        if (connection) connection.release();
    }
};

// ---------------------
// Assign Tags to a Post
// ---------------------

exports.assignTagsToPost = async (req, res) => {
    const { postId } = req.params;
    const { tagIds } = req.body; // Expecting an array of tag IDs

    if (!Array.isArray(tagIds) || tagIds.length === 0) {
        return res.status(400).json({ message: 'tagIds must be a non-empty array.' });
    }

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Delete existing tag assignments for the post
        await connection.query('DELETE FROM post_tags WHERE post_id = ?', [postId]);

        // Prepare values for bulk insert
        const values = tagIds.map((tagId) => [postId, tagId]);

        // Insert new tag assignments
        await connection.query('INSERT INTO post_tags (post_id, tag_id) VALUES ?', [values]);

        // Commit the transaction
        await connection.commit();
        res.status(200).json({ message: 'Tags assigned successfully' });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Error assigning tags:', err);
        res.status(500).json({ message: 'Error assigning tags', error: err.message });
    } finally {
        if (connection) connection.release();
    }
};
