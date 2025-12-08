const Joi = require('joi');

const hourRangeSchema = Joi.object({
  startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
    .messages({
      'string.pattern.base': 'startTime must be in HH:MM format (00:00-23:59)'
    }),
  endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
    .messages({
      'string.pattern.base': 'endTime must be in HH:MM format (00:00-23:59)'
    })
}).custom((value, helpers) => {
  const [startH, startM] = value.startTime.split(':').map(Number);
  const [endH, endM] = value.endTime.split(':').map(Number);
  if (endH * 60 + endM <= startH * 60 + startM) {
    return helpers.error('any.custom', { message: 'endTime must be after startTime' });
  }
  return value;
});

const validateAvailability = Joi.object({
  date: Joi.date().required(),
  status: Joi.string().valid('available', 'unavailable', 'booked', 'maintenance', 'blocked', 'partially-available', 'on-hold').optional(),
  reason: Joi.string().optional().allow(null, ''),
  availableHours: Joi.array().items(hourRangeSchema).optional().allow(null, [])
    .messages({
      'array.base': 'availableHours must be an array'
    }),
  unavailableHours: Joi.array().items(hourRangeSchema).optional().allow(null, [])
    .messages({
      'array.base': 'unavailableHours must be an array'
    }),
  onHoldHours: Joi.array().items(hourRangeSchema).optional().allow(null, [])
    .messages({
      'array.base': 'onHoldHours must be an array'
    })
});

module.exports = {
  validateAvailability
};

