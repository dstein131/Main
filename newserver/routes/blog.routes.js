// routes/blog.routes.js

const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blog.controller'); // Import blog controller
const { authenticateJWT } = require('../middleware/auth.middleware'); // Import JWT middleware

// Routes for blog posts
router.get('/posts', blogController.getAllPosts); // Get all blog posts
router.get('/posts/:id', blogController.getPostById); // Get a specific post by ID
router.post('/posts', authenticateJWT, blogController.createPost); // Create a new post (requires authentication)
router.put('/posts/:id', authenticateJWT, blogController.updatePost); // Update a post (requires authentication)
router.delete('/posts/:id', authenticateJWT, blogController.deletePost); // Delete a post (requires authentication)

// Routes for blog comments
router.get('/posts/:postId/comments', blogController.getCommentsByPostId); // Get all comments for a specific post
router.post('/posts/:postId/comments', authenticateJWT, blogController.createComment); // Create a comment for a post (requires authentication)

// Routes for categories
router.get('/categories', blogController.getAllCategories); // Get all categories
router.post('/categories', authenticateJWT, blogController.createCategory); // Create a new category (requires authentication)

// Routes for tags
router.get('/tags', blogController.getAllTags); // Get all tags
router.post('/tags', authenticateJWT, blogController.createTag); // Create a new tag (requires authentication)

// Routes for assigning categories and tags to posts
router.post('/posts/:postId/categories', authenticateJWT, blogController.assignCategoriesToPost); // Assign categories to a post
router.post('/posts/:postId/tags', authenticateJWT, blogController.assignTagsToPost); // Assign tags to a post

module.exports = router;
