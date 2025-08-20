const Joi = require('joi');

const validateStory = (data) => {
  const schema = Joi.object({
    title: Joi.string()
      .min(10)
      .max(200)
      .required()
      .messages({
        'string.min': 'Title must be at least 10 characters long',
        'string.max': 'Title cannot exceed 200 characters',
        'any.required': 'Title is required'
      }),
    
    excerpt: Joi.string()
      .min(20)
      .max(300)
      .required()
      .messages({
        'string.min': 'Excerpt must be at least 20 characters long',
        'string.max': 'Excerpt cannot exceed 300 characters',
        'any.required': 'Excerpt is required'
      }),
    
    content: Joi.string()
      .min(100)
      .required()
      .messages({
        'string.min': 'Content must be at least 100 characters long',
        'any.required': 'Content is required'
      }),
    
    featuredImage: Joi.string()
      .uri()
      .required()
      .messages({
        'string.uri': 'Featured image must be a valid URL',
        'any.required': 'Featured image is required'
      }),
    
    images: Joi.array().items(
      Joi.object({
        url: Joi.string().uri().required(),
        caption: Joi.string().max(200).optional(),
        alt: Joi.string().max(100).optional()
      })
    ).optional(),
    
    tags: Joi.array()
      .items(Joi.string().min(2).max(20))
      .max(10)
      .optional()
      .messages({
        'array.max': 'Cannot have more than 10 tags'
      }),
    
    category: Joi.string()
      .valid('Adventure', 'Culture', 'Food', 'Nature', 'City', 'Beach', 'Mountain', 'Heritage', 'Wellness', 'Photography')
      .required()
      .messages({
        'any.only': 'Category must be one of the predefined options',
        'any.required': 'Category is required'
      }),
    
    location: Joi.object({
      city: Joi.string().max(50).optional(),
      state: Joi.string().max(50).optional(),
      country: Joi.string().max(50).optional(),
      coordinates: Joi.object({
        lat: Joi.number().min(-90).max(90).optional(),
        lng: Joi.number().min(-180).max(180).optional()
      }).optional()
    }).optional(),
    
    readTime: Joi.number()
      .integer()
      .min(1)
      .max(60)
      .optional()
      .messages({
        'number.min': 'Read time must be at least 1 minute',
        'number.max': 'Read time cannot exceed 60 minutes'
      }),
    
    isPublished: Joi.boolean().optional(),
    isFeatured: Joi.boolean().optional(),
    
    seo: Joi.object({
      metaTitle: Joi.string().max(60).optional(),
      metaDescription: Joi.string().max(160).optional(),
      keywords: Joi.array().items(Joi.string()).max(10).optional()
    }).optional()
  });

  return schema.validate(data);
};

const validateComment = (data) => {
  const schema = Joi.object({
    content: Joi.string()
      .min(1)
      .max(1000)
      .required()
      .messages({
        'string.min': 'Comment cannot be empty',
        'string.max': 'Comment cannot exceed 1000 characters',
        'any.required': 'Comment content is required'
      })
  });

  return schema.validate(data);
};

module.exports = {
  validateStory,
  validateComment
}; 