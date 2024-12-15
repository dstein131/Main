// controllers/blog.controller.js

const pool = require('../pool/pool');

// ---------------------
// Blog Posts
// ---------------------

// Get all blog posts
exports.getAllPosts = (req, res) => {
    pool.query(
        `SELECT bp.*, u.username AS author 
         FROM blog_posts bp 
         JOIN users u ON bp.user_id = u.id 
         ORDER BY bp.created_at DESC`,
        (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Error fetching blog posts', error: err });
            }
            res.status(200).json({ posts: results });
        }
    );
};

// Get a specific blog post by ID
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
                return res.status(500).json({ message: 'Error fetching the blog post', error: err });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: 'Post not found' });
            }

            res.status(200).json({ post: results[0] });
        }
    );
};

// Create a new blog post
exports.createPost = (req, res) => {
    const { title, slug, content, status } = req.body;
    const userId = req.user.id; // Assuming user ID is available from authentication middleware

    pool.query(
        'INSERT INTO blog_posts (user_id, title, slug, content, status) VALUES (?, ?, ?, ?, ?)',
        [userId, title, slug, content, status || 'draft'],
        (err, results) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ message: 'Slug must be unique. Please choose another slug.' });
                }
                return res.status(500).json({ message: 'Error creating blog post', error: err });
            }
            res.status(201).json({ message: 'Blog post created successfully', postId: results.insertId });
        }
    );
};

// Update a blog post
exports.updatePost = (req, res) => {
    const { id } = req.params;
    const { title, slug, content, status } = req.body;
    const userId = req.user.id; // Assuming user ID is available from authentication middleware

    pool.query(
        'UPDATE blog_posts SET title = ?, slug = ?, content = ?, status = ? WHERE id = ? AND user_id = ?',
        [title, slug, content, status, id, userId],
        (err, results) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ message: 'Slug must be unique. Please choose another slug.' });
                }
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
                return res.status(500).json({ message: 'Error fetching comments', error: err });
            }

            res.status(200).json({ comments: results });
        }
    );
};

// Create a comment for a specific blog post
exports.createComment = (req, res) => {
    const { postId } = req.params;
    const { content } = req.body;
    const userId = req.user ? req.user.id : null; // User ID if authenticated, null for guest
    const { author_name, author_email } = req.body; // For guest comments

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
                return res.status(500).json({ message: 'Error fetching categories', error: err });
            }
            res.status(200).json({ categories: results });
        }
    );
};

// Create a new category
exports.createCategory = (req, res) => {
    const { name, slug } = req.body;

    pool.query(
        'INSERT INTO blog_categories (name, slug) VALUES (?, ?)',
        [name, slug],
        (err, results) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ message: 'Category name and slug must be unique.' });
                }
                return res.status(500).json({ message: 'Error creating category', error: err });
            }
            res.status(201).json({ message: 'Category created successfully', categoryId: results.insertId });
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
                return res.status(500).json({ message: 'Error fetching tags', error: err });
            }
            res.status(200).json({ tags: results });
        }
    );
};

// Create a new tag
exports.createTag = (req, res) => {
    const { name, slug } = req.body;

    pool.query(
        'INSERT INTO blog_tags (name, slug) VALUES (?, ?)',
        [name, slug],
        (err, results) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ message: 'Tag name and slug must be unique.' });
                }
                return res.status(500).json({ message: 'Error creating tag', error: err });
            }
            res.status(201).json({ message: 'Tag created successfully', tagId: results.insertId });
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
            return res.status(500).json({ message: 'Error connecting to the database', error: err });
        }

        connection.beginTransaction((err) => {
            if (err) {
                connection.release();
                return res.status(500).json({ message: 'Error starting transaction', error: err });
            }

            // First, delete existing category assignments for the post
            connection.query(
                'DELETE FROM post_categories WHERE post_id = ?',
                [postId],
                (err) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            res.status(500).json({ message: 'Error removing existing categories', error: err });
                        });
                    }

                    if (categoryIds.length === 0) {
                        // If no categories to assign, commit the transaction
                        return connection.commit((err) => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release();
                                    res.status(500).json({ message: 'Error committing transaction', error: err });
                                });
                            }
                            connection.release();
                            res.status(200).json({ message: 'Categories unassigned successfully' });
                        });
                    }

                    // Insert new category assignments
                    const values = categoryIds.map((categoryId) => [postId, categoryId]);
                    connection.query(
                        'INSERT INTO post_categories (post_id, category_id) VALUES ?',
                        [values],
                        (err) => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release();
                                    res.status(500).json({ message: 'Error assigning categories', error: err });
                                });
                            }

                            // Commit the transaction
                            connection.commit((err) => {
                                if (err) {
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
            return res.status(500).json({ message: 'Error connecting to the database', error: err });
        }

        connection.beginTransaction((err) => {
            if (err) {
                connection.release();
                return res.status(500).json({ message: 'Error starting transaction', error: err });
            }

            // First, delete existing tag assignments for the post
            connection.query(
                'DELETE FROM post_tags WHERE post_id = ?',
                [postId],
                (err) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            res.status(500).json({ message: 'Error removing existing tags', error: err });
                        });
                    }

                    if (tagIds.length === 0) {
                        // If no tags to assign, commit the transaction
                        return connection.commit((err) => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release();
                                    res.status(500).json({ message: 'Error committing transaction', error: err });
                                });
                            }
                            connection.release();
                            res.status(200).json({ message: 'Tags unassigned successfully' });
                        });
                    }

                    // Insert new tag assignments
                    const values = tagIds.map((tagId) => [postId, tagId]);
                    connection.query(
                        'INSERT INTO post_tags (post_id, tag_id) VALUES ?',
                        [values],
                        (err) => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release();
                                    res.status(500).json({ message: 'Error assigning tags', error: err });
                                });
                            }

                            // Commit the transaction
                            connection.commit((err) => {
                                if (err) {
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
