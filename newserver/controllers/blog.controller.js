// controllers/blog.controller.js

const pool = require('../pool/pool');

// ---------------------
// Blog Posts
// ---------------------

// Get all blog posts with associated categories, tags, and comment count
exports.getAllPosts = (req, res) => {
    pool.query(
        `SELECT bp.*, u.username AS author, 
            (SELECT COUNT(*) FROM blog_comments bc WHERE bc.post_id = bp.id) AS commentCount
         FROM blog_posts bp 
         JOIN users u ON bp.user_id = u.id 
         ORDER BY bp.created_at DESC`,
        (err, results) => {
            if (err) {
                console.error('Error fetching blog posts:', err);
                return res.status(500).json({ message: 'Error fetching blog posts', error: err });
            }

            const posts = results.map(post => ({ ...post, categories: [], tags: [] }));

            if (posts.length === 0) {
                return res.status(200).json({ posts });
            }

            const postIds = posts.map(post => post.id);

            // Fetch categories for all posts
            pool.query(
                `SELECT pc.post_id, bc.id, bc.name
                 FROM post_categories pc 
                 JOIN blog_categories bc ON pc.category_id = bc.id 
                 WHERE pc.post_id IN (?)`,
                [postIds],
                (err, categoryResults) => {
                    if (err) {
                        console.error('Error fetching categories:', err);
                        return res.status(500).json({ message: 'Error fetching categories', error: err });
                    }

                    // Assign categories to respective posts
                    categoryResults.forEach(cat => {
                        const post = posts.find(p => p.id === cat.post_id);
                        if (post) {
                            post.categories.push({
                                id: cat.id,
                                name: cat.name
                            });
                        }
                    });

                    // Fetch tags for all posts
                    pool.query(
                        `SELECT pt.post_id, bt.id, bt.name 
                         FROM post_tags pt 
                         JOIN blog_tags bt ON pt.tag_id = bt.id 
                         WHERE pt.post_id IN (?)`,
                        [postIds],
                        (err, tagResults) => {
                            if (err) {
                                console.error('Error fetching tags:', err);
                                return res.status(500).json({ message: 'Error fetching tags', error: err });
                            }

                            // Assign tags to respective posts
                            tagResults.forEach(tag => {
                                const post = posts.find(p => p.id === tag.post_id);
                                if (post) {
                                    post.tags.push({
                                        id: tag.id,
                                        name: tag.name
                                    });
                                }
                            });

                            res.status(200).json({ posts });
                        }
                    );
                }
            );
        }
    );
};


// Get a specific blog post by ID with associated categories and tags
exports.getPostById = (req, res) => {
    const { id } = req.params;

    pool.query(
        `SELECT bp.*, u.username AS author 
         FROM blog_posts bp 
         JOIN users u ON bp.user_id = u.id 
         WHERE bp.id = ?`,
        [id],
        (err, results) => {
            if (err) {
                console.error('Error fetching the blog post:', err);
                return res.status(500).json({ message: 'Error fetching the blog post', error: err });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: 'Post not found' });
            }

            const post = { ...results[0], categories: [], tags: [] };

            // Fetch categories for the post
            pool.query(
                `SELECT bc.id, bc.name 
                 FROM post_categories pc 
                 JOIN blog_categories bc ON pc.category_id = bc.id 
                 WHERE pc.post_id = ?`,
                [id],
                (err, categoryResults) => {
                    if (err) {
                        console.error('Error fetching categories:', err);
                        return res.status(500).json({ message: 'Error fetching categories', error: err });
                    }

                    categoryResults.forEach(cat => {
                        post.categories.push({
                            id: cat.id,
                            name: cat.name
                        });
                    });

                    // Fetch tags for the post
                    pool.query(
                        `SELECT bt.id, bt.name 
                         FROM post_tags pt 
                         JOIN blog_tags bt ON pt.tag_id = bt.id 
                         WHERE pt.post_id = ?`,
                        [id],
                        (err, tagResults) => {
                            if (err) {
                                console.error('Error fetching tags:', err);
                                return res.status(500).json({ message: 'Error fetching tags', error: err });
                            }

                            tagResults.forEach(tag => {
                                post.tags.push({
                                    id: tag.id,
                                    name: tag.name
                                });
                            });

                            res.status(200).json({ post });
                        }
                    );
                }
            );
        }
    );
};

// Create a new blog post
// Create a new blog post
exports.createPost = (req, res) => {
    const { title, content, status } = req.body;
    const userId = req.user.id; // Assuming user ID is available from authentication middleware

    pool.query(
        'INSERT INTO blog_posts (user_id, title, content, status) VALUES (?, ?, ?, ?)',
        [userId, title, content, status || 'draft'],
        (err, results) => {
            if (err) {
                console.error('Error creating blog post:', err);
                return res.status(500).json({ message: 'Error creating blog post', error: err });
            }

            const insertedId = results.insertId;

            // Fetch the newly created post
            pool.query(
                `SELECT bp.*, u.username AS author, 
                    (SELECT COUNT(*) FROM blog_comments bc WHERE bc.post_id = bp.id) AS commentCount
                 FROM blog_posts bp
                 JOIN users u ON bp.user_id = u.id
                 WHERE bp.id = ?`,
                [insertedId],
                (err, postResults) => {
                    if (err) {
                        console.error('Error fetching the created blog post:', err);
                        return res.status(500).json({ message: 'Error fetching the created blog post', error: err });
                    }

                    const createdPost = postResults[0];
                    res.status(201).json({ message: 'Blog post created successfully', post: createdPost });
                }
            );
        }
    );
};



// Update a blog post
exports.updatePost = (req, res) => {
    const { id } = req.params;
    const { title, content, status } = req.body;
    const userId = req.user.id; // Assuming user ID is available from authentication middleware

    pool.query(
        'UPDATE blog_posts SET title = ?, content = ?, status = ? WHERE id = ? AND user_id = ?',
        [title, content, status, id, userId],
        (err, results) => {
            if (err) {
                console.error('Error updating blog post:', err);
                return res.status(500).json({ message: 'Error updating blog post', error: err });
            }

            if (results.affectedRows === 0) {
                return res.status(403).json({ message: 'You do not have permission to update this post or post not found' });
            }

            res.status(200).json({ message: 'Blog post updated successfully' });
        }
    );
};

// Delete a blog post
exports.deletePost = (req, res) => {
    const { id } = req.params;
    const userId = req.user.id; // Assuming user ID is available from authentication middleware

    pool.query(
        'DELETE FROM blog_posts WHERE id = ? AND user_id = ?',
        [id, userId],
        (err, results) => {
            if (err) {
                console.error('Error deleting blog post:', err);
                return res.status(500).json({ message: 'Error deleting blog post', error: err });
            }

            if (results.affectedRows === 0) {
                return res.status(403).json({ message: 'You do not have permission to delete this post or post not found' });
            }

            res.status(200).json({ message: 'Blog post deleted successfully' });
        }
    );
};

// ---------------------
// Blog Comments
// ---------------------

// Get all comments for a specific blog post
exports.getCommentsByPostId = (req, res) => {
    const { postId } = req.params;

    pool.query(
        `SELECT bc.*, u.username AS author 
         FROM blog_comments bc 
         LEFT JOIN users u ON bc.user_id = u.id 
         WHERE bc.post_id = ? 
         ORDER BY bc.created_at ASC`,
        [postId],
        (err, results) => {
            if (err) {
                console.error('Error fetching comments:', err);
                return res.status(500).json({ message: 'Error fetching comments', error: err });
            }

            res.status(200).json({ comments: results });
        }
    );
};

// Create a comment for a specific blog post
exports.createComment = (req, res) => {
    const { postId } = req.params;
    const { content, author_name, author_email } = req.body;
    const userId = req.user ? req.user.id : null; // User ID if authenticated, null for guest

    // Validate guest comment fields if user is not authenticated
    if (!userId) {
        if (!author_name || !author_email) {
            return res.status(400).json({ message: 'Author name and email are required for guest comments.' });
        }
    }

    pool.query(
        `INSERT INTO blog_comments (post_id, user_id, author_name, author_email, content) 
         VALUES (?, ?, ?, ?, ?)`,
        [postId, userId, author_name || null, author_email || null, content],
        (err, results) => {
            if (err) {
                console.error('Error adding comment:', err);
                return res.status(500).json({ message: 'Error adding comment', error: err });
            }
            res.status(201).json({ message: 'Comment added successfully', commentId: results.insertId });
        }
    );
};

// ---------------------
// Blog Categories
// ---------------------

// Get all categories
exports.getAllCategories = (req, res) => {
    pool.query(
        'SELECT * FROM blog_categories ORDER BY name ASC',
        (err, results) => {
            if (err) {
                console.error('Error fetching categories:', err);
                return res.status(500).json({ message: 'Error fetching categories', error: err });
            }
            res.status(200).json({ categories: results });
        }
    );
};

// Get a single category by ID
exports.getCategoryById = (req, res) => {
    const { id } = req.params;

    pool.query(
        'SELECT * FROM blog_categories WHERE id = ?',
        [id],
        (err, results) => {
            if (err) {
                console.error('Error fetching category:', err);
                return res.status(500).json({ message: 'Error fetching category', error: err });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: 'Category not found.' });
            }

            res.status(200).json({ category: results[0] });
        }
    );
};

// Create a new category
exports.createCategory = (req, res) => {
    const { name } = req.body;

    pool.query(
        'INSERT INTO blog_categories (name) VALUES (?)',
        [name],
        (err, results) => {
            if (err) {
                console.error('Error creating category:', err);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ message: 'Category name must be unique.' });
                }
                return res.status(500).json({ message: 'Error creating category', error: err });
            }
            res.status(201).json({ message: 'Category created successfully', categoryId: results.insertId });
        }
    );
};

// Update a category
exports.updateCategory = (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    pool.query(
        'UPDATE blog_categories SET name = ? WHERE id = ?',
        [name, id],
        (err, results) => {
            if (err) {
                console.error('Error updating category:', err);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ message: 'Category name must be unique.' });
                }
                return res.status(500).json({ message: 'Error updating category', error: err });
            }

            if (results.affectedRows === 0) {
                return res.status(404).json({ message: 'Category not found.' });
            }

            res.status(200).json({ message: 'Category updated successfully.' });
        }
    );
};

// ---------------------
// Blog Tags
// ---------------------

// Get all tags
exports.getAllTags = (req, res) => {
    pool.query(
        'SELECT * FROM blog_tags ORDER BY name ASC',
        (err, results) => {
            if (err) {
                console.error('Error fetching tags:', err);
                return res.status(500).json({ message: 'Error fetching tags', error: err });
            }
            res.status(200).json({ tags: results });
        }
    );
};

// Get a single tag by ID
exports.getTagById = (req, res) => {
    const { id } = req.params;

    pool.query(
        'SELECT * FROM blog_tags WHERE id = ?',
        [id],
        (err, results) => {
            if (err) {
                console.error('Error fetching tag:', err);
                return res.status(500).json({ message: 'Error fetching tag', error: err });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: 'Tag not found.' });
            }

            res.status(200).json({ tag: results[0] });
        }
    );
};

// Create a new tag
exports.createTag = (req, res) => {
    const { name } = req.body;

    pool.query(
        'INSERT INTO blog_tags (name) VALUES (?)',
        [name],
        (err, results) => {
            if (err) {
                console.error('Error creating tag:', err);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ message: 'Tag name must be unique.' });
                }
                return res.status(500).json({ message: 'Error creating tag', error: err });
            }
            res.status(201).json({ message: 'Tag created successfully', tagId: results.insertId });
        }
    );
};

// Update a tag
exports.updateTag = (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    pool.query(
        'UPDATE blog_tags SET name = ? WHERE id = ?',
        [name, id],
        (err, results) => {
            if (err) {
                console.error('Error updating tag:', err);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ message: 'Tag name must be unique.' });
                }
                return res.status(500).json({ message: 'Error updating tag', error: err });
            }

            if (results.affectedRows === 0) {
                return res.status(404).json({ message: 'Tag not found.' });
            }

            res.status(200).json({ message: 'Tag updated successfully.' });
        }
    );
};

// ---------------------
// Assign Categories to a Post
// ---------------------

exports.assignCategoriesToPost = (req, res) => {
    const { postId } = req.params;
    const { categoryIds } = req.body; // Expecting an array of category IDs

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
        return res.status(400).json({ message: 'categoryIds must be a non-empty array.' });
    }

    // Start a transaction
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error connecting to the database:', err);
            return res.status(500).json({ message: 'Error connecting to the database', error: err });
        }

        connection.beginTransaction((err) => {
            if (err) {
                console.error('Error starting transaction:', err);
                connection.release();
                return res.status(500).json({ message: 'Error starting transaction', error: err });
            }

            // First, delete existing category assignments for the post
            connection.query(
                'DELETE FROM post_categories WHERE post_id = ?',
                [postId],
                (err) => {
                    if (err) {
                        console.error('Error removing existing categories:', err);
                        return connection.rollback(() => {
                            connection.release();
                            res.status(500).json({ message: 'Error removing existing categories', error: err });
                        });
                    }

                    // Prepare values for bulk insert
                    const values = categoryIds.map((categoryId) => [postId, categoryId]);

                    // Insert new category assignments
                    connection.query(
                        'INSERT INTO post_categories (post_id, category_id) VALUES ?',
                        [values],
                        (err) => {
                            if (err) {
                                console.error('Error assigning categories:', err);
                                return connection.rollback(() => {
                                    connection.release();
                                    res.status(500).json({ message: 'Error assigning categories', error: err });
                                });
                            }

                            // Commit the transaction
                            connection.commit((err) => {
                                if (err) {
                                    console.error('Error committing transaction:', err);
                                    return connection.rollback(() => {
                                        connection.release();
                                        res.status(500).json({ message: 'Error committing transaction', error: err });
                                    });
                                }
                                connection.release();
                                res.status(200).json({ message: 'Categories assigned successfully' });
                            });
                        }
                    );
                }
            );
        });
    });
};

// ---------------------
// Assign Tags to a Post
// ---------------------

exports.assignTagsToPost = (req, res) => {
    const { postId } = req.params;
    const { tagIds } = req.body; // Expecting an array of tag IDs

    if (!Array.isArray(tagIds) || tagIds.length === 0) {
        return res.status(400).json({ message: 'tagIds must be a non-empty array.' });
    }

    // Start a transaction
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error connecting to the database:', err);
            return res.status(500).json({ message: 'Error connecting to the database', error: err });
        }

        connection.beginTransaction((err) => {
            if (err) {
                console.error('Error starting transaction:', err);
                connection.release();
                return res.status(500).json({ message: 'Error starting transaction', error: err });
            }

            // First, delete existing tag assignments for the post
            connection.query(
                'DELETE FROM post_tags WHERE post_id = ?',
                [postId],
                (err) => {
                    if (err) {
                        console.error('Error removing existing tags:', err);
                        return connection.rollback(() => {
                            connection.release();
                            res.status(500).json({ message: 'Error removing existing tags', error: err });
                        });
                    }

                    // Prepare values for bulk insert
                    const values = tagIds.map((tagId) => [postId, tagId]);

                    // Insert new tag assignments
                    connection.query(
                        'INSERT INTO post_tags (post_id, tag_id) VALUES ?',
                        [values],
                        (err) => {
                            if (err) {
                                console.error('Error assigning tags:', err);
                                return connection.rollback(() => {
                                    connection.release();
                                    res.status(500).json({ message: 'Error assigning tags', error: err });
                                });
                            }

                            // Commit the transaction
                            connection.commit((err) => {
                                if (err) {
                                    console.error('Error committing transaction:', err);
                                    return connection.rollback(() => {
                                        connection.release();
                                        res.status(500).json({ message: 'Error committing transaction', error: err });
                                    });
                                }
                                connection.release();
                                res.status(200).json({ message: 'Tags assigned successfully' });
                            });
                        }
                    );
                }
            );
        });
    });
};
