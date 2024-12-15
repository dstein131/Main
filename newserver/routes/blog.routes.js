// routes/blog.routes.js

const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blog.controller'); // Import blog controller
const { authenticateJWT } = require('../middleware/auth.middleware'); // Import JWT middleware

// ---------------------
// Routes for Blog Posts
// ---------------------

// Get all blog posts
router.get('/posts', blogController.getAllPosts);

// Get a specific blog post by ID
router.get('/posts/:id', blogController.getPostById);

// Create a new blog post (requires authentication)
router.post('/posts', authenticateJWT, blogController.createPost);

// Update a blog post (requires authentication)
router.put('/posts/:id', authenticateJWT, blogController.updatePost);

// Delete a blog post (requires authentication)
router.delete('/posts/:id', authenticateJWT, blogController.deletePost);

// ---------------------
// Routes for Blog Comments
// ---------------------

// Get all comments for a specific post
router.get('/posts/:postId/comments', blogController.getCommentsByPostId);

// Create a comment for a specific post
// Removed authenticateJWT to allow both authenticated users and guests to add comments
router.post('/posts/:postId/comments', blogController.createComment);

// ---------------------
// Routes for Blog Categories
// ---------------------

// Get all categories
router.get('/categories', blogController.getAllCategories);

// Create a new category (requires authentication)
router.post('/categories', authenticateJWT, blogController.createCategory);

// ---------------------
// Routes for Blog Tags
// ---------------------

// Get all tags
router.get('/tags', blogController.getAllTags);

// Create a new tag (requires authentication)
router.post('/tags', authenticateJWT, blogController.createTag);

// ---------------------
// Routes for Assigning Categories and Tags to Posts
// ---------------------

// Assign categories to a post (requires authentication)
router.post('/posts/:postId/categories', authenticateJWT, blogController.assignCategoriesToPost);

// Assign tags to a post (requires authentication)
router.post('/posts/:postId/tags', authenticateJWT, blogController.assignTagsToPost);

module.exports = router;
