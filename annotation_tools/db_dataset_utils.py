"""
Utilities for inserting and working with COCO style dataset formats.

Document Formats:

image{
  "id" : int,
  "width" : int,
  "height" : int,
  "file_name" : str,
  "license" : int,
  "url" : str,
  "date_captured" : datetime
}

annotation{
  "id" : int,
  "image_id" : int,
  "category_id" : int,
  "segmentation" : RLE or [polygon],
  "area" : float,
  "bbox" : [x,y,width,height],
  "iscrowd" : 0 or 1,
}

category{
  "id" : int,
  "name" : str,
  "supercategory" : str,
}

"""


from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import pymongo

def drop_dataset(db):
  """ Drop the collections.
  """
  db.drop_collection('category')
  db.drop_collection('image')
  db.drop_collection('annotation')

def ensure_dataset_indices(db):
  """ Ensure the collections exist and create the indices
  """
  db.category.create_index("id", unique=True)
  db.image.create_index("id", unique=True)
  db.annotation.create_index("id", unique=True)
  db.annotation.create_index("image_id")
  db.license.create_index("id", unique=True)

def load_dataset(db, dataset):
  """ Load a COCO style dataset.
  """

  print("Loading Dataset")

  # Insert the categories
  assert 'categories' in dataset, "Failed to find `categories` in dataset object."
  categories = dataset['categories']
  print("Inserting %d categories" % (len(categories),))
  if len(categories) > 0:
    response = db.category.insert_many(categories, ordered=False)

  # Insert the images
  assert 'images' in dataset, "Failed to find `images` in dataset object."
  images = dataset['images']
  print("Inserting %d images" % (len(images),))
  if len(images) > 0:
    response =db.image.insert_many(images, ordered=False)

  # Insert the annotations
  assert 'annotations' in dataset, "Failed to find `annotations` in dataset object."
  annotations = dataset['annotations']
  print("Inserting %d annotations" % (len(annotations),))
  if len(annotations) > 0:
    response = db.annotation.insert_many(annotations, ordered=False)

  # Insert the licenses
  assert 'licenses' in dataset, "Failed to find `licenses` in dataset object."
  licenses = dataset['licenses']
  print("Inserting %d licenses" % (len(licenses),))
  if len(licenses) > 0:
    response = db.license.insert_many(licenses, ordered=False)

def export_dataset(db):

  print("Exporting Dataset")

  categories = list(db.category.find(projection={'_id' : False}))
  print("Found %d categories" % (len(categories),))

  images = list(db.image.find(projection={'_id' : False}))
  print("Found %d images" % (len(images),))

  annotations = list(db.annotation.find(projection={'_id' : False}))
  print("Found %d annotations" % (len(annotations),))

  licenses = list(db.license.find(projection={'_id' : False}))
  print("Found %d licenses" % (len(licenses),))

  dataset = {
    'categories' : categories,
    'annotations' : annotations,
    'images' : images,
    'licenses' : licenses
  }

  return dataset

