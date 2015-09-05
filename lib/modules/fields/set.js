var proto = Astro.BaseClass.prototype;

// Overloaded functions.

proto._setOne = function(fieldName, fieldValue, options) {
  var doc = this;
  var Class = doc.constructor;
  var event;
  var plainFieldValue;

  // Don't allow setting undefined value.
  if (_.isUndefined(fieldValue)) {
    return;
  }

  // Deny changing the "_id" property.
  if (fieldName === '_id' && doc._id) {
    return;
  }

  // Trigger the "beforeSet" event handlers.
  event = new Astro.Event('beforeSet', {
    fieldName: fieldName,
    fieldValue: fieldValue
  });
  event.target = doc;
  Class.emitEvent(event);

  // If an event was prevented from the execution, then we stop here.
  if (event.defaultPrevented) {
    return;
  }

  // Set default options of the function. By default, we cast value being set.
  options = _.extend({
    cast: true,
    modifier: true
  }, options);

  Astro.utils.fields.traverseNestedDocs(
    doc,
    fieldName,
    function(nestedDoc, nestedFieldName, Class, field, index) {
      if (field) {
        // If we are setting a value of a single nested field, then the value
        // has to be an object.
        if (
          _.isUndefined(index) &&
          field instanceof Astro.fields.object &&
          !_.isObject(fieldValue)
        ) {
          return;
        }

        // If we are setting a value of many nested fields, then the value has
        // to be an array.
        if (
          _.isUndefined(index) &&
          field instanceof Astro.fields.array &&
          !_.isArray(fieldValue)
        ) {
          return;
        }

        // Try casting the value to the proper type.
        if (options.cast) {
          fieldValue = field.cast(fieldValue);
        }

        // Get a plain value of a field for a modifier.
        plainFieldValue = field.plain(EJSON.clone(fieldValue));
      } else if (Class) {
        Astro.errors.warn(
          'fields.not_defined_field',
          nestedFieldName,
          Class.getName()
        );
      }

      // Set the given value on the document.
      if (_.isUndefined(index)) {
        nestedDoc[nestedFieldName] = fieldValue;
      } else {
        nestedDoc[nestedFieldName][index] = fieldValue;
      }

      // Add modifier.
      if (options.modifier) {
        if (_.isUndefined(plainFieldValue)) {
          plainFieldValue = EJSON.clone(fieldValue);
        }
        if (nestedDoc instanceof Astro.BaseClass) {
          if (_.isUndefined(index)) {
            nestedDoc._addModifier('$set', nestedFieldName, plainFieldValue);
          } else {
            var fullFieldName = nestedFieldName + '.' + index;
            nestedDoc._addModifier('$set', fullFieldName, plainFieldValue);
          }
        } else {
          doc._addModifier('$set', fieldName, plainFieldValue);
        }
      }
    }
  );

  // Trigger the "afterSet" event handlers.
  event = new Astro.Event('afterSet', {
    fieldName: fieldName,
    fieldValue: fieldValue
  });
  event.target = doc;
  Class.emitEvent(event);
};

proto._setMany = function(fieldsValues, options) {
  var doc = this;

  // Set multiple fields.
  _.each(fieldsValues, function(fieldValue, fieldName) {
    doc._setOne(fieldName, fieldValue, options);
  });
};

// Public.

proto.set = function(/* arguments */) {
  var doc = this;

  if (arguments.length === 1 && _.isObject(arguments[0])) {
    doc._setMany(arguments[0]);
  } else if (arguments.length === 2 && _.isString(arguments[0])) {
    doc._setOne(arguments[0], arguments[1]);
  }
};