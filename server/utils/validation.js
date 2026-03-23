const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware to check validation results and return errors
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

// Auth validation rules
const authValidation = {
  register: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['admin', 'client']).withMessage('Role must be admin or client'),
    handleValidationErrors,
  ],
  login: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
    handleValidationErrors,
  ],
};

// Couple validation rules
const coupleValidation = {
  create: [
    body('person_a_name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Person A name is required (max 100 chars)'),
    body('person_b_name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Person B name is required (max 100 chars)'),
    handleValidationErrors,
  ],
  idParam: [
    param('id').isUUID().withMessage('Valid couple ID required'),
    handleValidationErrors,
  ],
};

// Template validation rules
const templateValidation = {
  create: [
    body('name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Template name required (max 100 chars)'),
    body('description')
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('Description required (max 500 chars)'),
    body('prompt_text')
      .trim()
      .isLength({ min: 10, max: 2000 })
      .withMessage('Prompt text required (10-2000 chars)'),
    body('category')
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category required (max 50 chars)'),
    handleValidationErrors,
  ],
  update: [
    param('id').isUUID().withMessage('Valid template ID required'),
    body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Name max 100 chars'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('Description max 500 chars'),
    body('prompt_text').optional().trim().isLength({ min: 10, max: 2000 }).withMessage('Prompt text 10-2000 chars'),
    body('category').optional().trim().isLength({ max: 50 }).withMessage('Category max 50 chars'),
    body('is_active').optional().isBoolean().withMessage('is_active must be boolean'),
    handleValidationErrors,
  ],
  idParam: [
    param('id').isUUID().withMessage('Valid template ID required'),
    handleValidationErrors,
  ],
};

// Merge validation rules
const mergeValidation = {
  create: [
    body('couple_id').isUUID().withMessage('Valid couple ID required'),
    body('template_id').isUUID().withMessage('Valid template ID required'),
    handleValidationErrors,
  ],
  idParam: [
    param('id').isUUID().withMessage('Valid merge ID required'),
    handleValidationErrors,
  ],
};

// Client validation rules
const clientValidation = {
  unlock: [
    body('password').notEmpty().withMessage('Password required'),
    body('couple_id').isUUID().withMessage('Valid couple ID required'),
    handleValidationErrors,
  ],
};

module.exports = {
  handleValidationErrors,
  authValidation,
  coupleValidation,
  templateValidation,
  mergeValidation,
  clientValidation,
};
