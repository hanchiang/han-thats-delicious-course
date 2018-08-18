const mongoose = require('mongoose');
const slug = require('slugs');

mongoose.Promise = global.Promise;

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    required: 'Please enter a store name!'
  },
  slug: String, // auto generated
  description: {
    type: String,
    trim: true
  },
  tags: [String],
  created: {
    type: Date,
    default: Date.now()
  },
  location: {
    type: {
      type: String,
      default: 'Point'
    },
    coordinates: [
      {
        // mongodb stores location in the form: lng,lat
        type: Number,
        required: 'You must supply coordinates!'
      }
    ],
    address: {
      type: String,
      required: 'You must supply an address!'
    }
  },
  photo: String,
  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: 'You must supply an author'
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Define our indexes
storeSchema.index({
  name: 'text',
  description: 'text'
});

storeSchema.index({ location: '2dsphere' })

storeSchema.pre('save', async function(next) {
  if (!this.isModified('name')) {
    return next();
  }
  this.slug = slug(this.name);
  // Find other stores that have a slug of wes, wes-1, wes-2
  const slugRegex = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
  const storesWithSlug = await this.constructor.find({slug: slugRegex});
  console.log(storesWithSlug.length);
  if (storesWithSlug.length) {
    this.slug = `${this.slug}-${storesWithSlug.length+1}`;
    console.log(this.slug);
  }

  // TODO: strip store name of html tags
  next();
});

storeSchema.statics.getTagsList = async function() {
  // Group everything based on the tag, create a new field 'count' for each of those groups.
  const cursor = this.aggregate([
    { $unwind: '$tags'},
    { $group: { _id: '$tags', count: { $sum: 1 } }},
    { $sort: { count: -1 }}
  ])
  .cursor({ batchSize: 0 })
  .exec();

  const tags = [];
  while(tag = await cursor.next()) {
    tags.push(tag)
  }
  return tags;
};

storeSchema.statics.getTopStores = async function() {
  const cursor = this.aggregate([
    // Lookup stores and populate their reviews
    { $lookup: {
      from: 'reviews', // mongodb will take 'Review' model and make it lowercase
      localField: '_id',
      foreignField: 'store',
      as: 'reviews'
    }},
    // Filter for only items that have 2 or more reviews
    { $match: {
      'reviews.1': { $exists: true }
    }},
    // Add the average reviews field
    { $project: {
      photo: 1,
      name: 1,
      reviews: 1,
      slug: 1,
      averageRating: { $avg: '$reviews.rating' }
    }},
    // Sort it by our new field, highest reviews first
    { $sort: { 
      averageRating: -1
    }},
    // Limit to at most 10
    { $limit: 10 }
  ])
  .cursor({ batchSize: 0})
  .exec();

  const stores = [];
  while(store = await cursor.next()) {
    stores.push(store);
  }
  return stores;
}

storeSchema.virtual('reviews', {
  ref: 'Review',        // What model to link?
  localField: '_id',    // which field on Store?
  foreignField: 'store' // which field on Review?
});

function autopopulate(next) {
  this.populate('reviews');
  next();
}

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);

module.exports = mongoose.model('Store', storeSchema);