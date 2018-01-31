"""
Utilities for inserting and working with COCO style dataset formats.

Document Formats:

image{
  "id" : str,
  "width" : int,
  "height" : int,
  "file_name" : str,
  "license" : str,
  "rights_holder" : str,
  "url" : str,
  "date_captured" : datetime (str)
}

annotation{
  "id" : str,
  "image_id" : str,
  "category_id" : str,
  "segmentation" : RLE or [polygon],
  "area" : float,
  "bbox" : [x,y,width,height],
  "iscrowd" : 0 or 1,
  "keypoints" : [x, y, v, ...],
  "num_keypoints" : int
}

category{
  "id" : str,
  "name" : str,
  "supercategory" : str,
  "keypoints" : [str, ...],
  "keypoints_style" : [str, ...],
}

license{
  "id" : str,
  "name" : str,
  "url" : str,
}

IDs will be converted to strings and annotations will be normalized.

"""

from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import argparse
import json

from pymongo.errors import BulkWriteError

from annotation_tools.annotation_tools import get_db
from annotation_tools.utils import COLOR_LIST

DUPLICATE_KEY_ERROR_CODE = 11000

def drop_dataset(db):
  """ Drop the collections.
  """
  print("Dropping the dataset collections.")

  db.drop_collection('category')
  db.drop_collection('image')
  db.drop_collection('annotation')
  db.drop_collection('license')

def ensure_dataset_indices(db):
  """ Ensure the collections exist and create the indices
  """
  db.category.create_index("id", unique=True)
  db.image.create_index("id", unique=True)
  db.annotation.create_index("id", unique=True)
  db.annotation.create_index("image_id")
  db.license.create_index("id", unique=True)

def load_dataset(db, dataset, normalize=False):
  """ Load a COCO style dataset.
  Args:
    db: A mongodb database handle.
    dataset: A COCO style dataset.
    normalize: Should the annotations be normalized by the width and height stored with the images?
  """

  print("Loading Dataset")

  # Insert the categories
  assert 'categories' in dataset, "Failed to find `categories` in dataset object."
  categories = dataset['categories']
  print("Inserting %d categories" % (len(categories),))
  if len(categories) > 0:

    # Ensure that the category ids are strings
    for cat in categories:
      cat['id'] = str(cat['id'])

      # Add specific colors to the keypoints
      if 'keypoints' in cat and 'keypoints_style' not in cat:
        print("\tWARNING: Adding keypoint styles to category: %s" % (cat['name'],))
        keypoints_style = []
        for k in range(len(cat['keypoints'])):
          keypoints_style.append(COLOR_LIST[k % len(COLOR_LIST)])
        cat['keypoints_style'] = keypoints_style

    try:
      response = db.category.insert_many(categories, ordered=False)
      print("Successfully inserted %d categories" % (len(response.inserted_ids),))
    except BulkWriteError as bwe:
      panic = filter(lambda x: x['code'] != DUPLICATE_KEY_ERROR_CODE, bwe.details['writeErrors'])
      if len(panic) > 0:
        raise
      print("Attempted to insert duplicate categories, %d new categories inserted" % (bwe.details['nInserted'],))



  # Insert the images
  assert 'images' in dataset, "Failed to find `images` in dataset object."
  images = dataset['images']
  print("Inserting %d images" % (len(images),))
  if len(images) > 0:

    # Ensure that the image ids and license ids are strings
    for image in images:
      image['id'] = str(image['id'])
      image['license'] = str(image['license']) if 'license' in image else ''

      # If loading the actual COCO dataset, then remap `coco_url` to `url`
      if 'url' not in image and 'coco_url' in image:
        image['url'] = image['coco_url']

      # Add a blank rights holder if it is not present
      if 'rights_holder' not in image:
        image['rights_holder'] = ''

    try:
      response = db.image.insert_many(images, ordered=False)
      print("Successfully inserted %d images" % (len(response.inserted_ids),))

    except BulkWriteError as bwe:
      panic = filter(lambda x: x['code'] != DUPLICATE_KEY_ERROR_CODE, bwe.details['writeErrors'])
      if len(panic) > 0:
        raise
      print("Attempted to insert duplicate images, %d new images inserted" % (bwe.details['nInserted'],))


  # Insert the annotations
  assert 'annotations' in dataset, "Failed to find `annotations` in dataset object."
  annotations = dataset['annotations']
  print("Inserting %d annotations" % (len(annotations),))
  if len(annotations) > 0:

    # Ensure that the ids are strings
    for anno in annotations:
      anno['id'] = str(anno['id'])
      anno['image_id'] = str(anno['image_id'])
      anno['category_id'] = str(anno['category_id'])

    if normalize:
      image_id_to_w_h = {image['id'] : (float(image['width']), float(image['height']))
                         for image in images}

      for anno in annotations:
        image_width, image_height = image_id_to_w_h[anno['image_id']]
        x, y, w, h = anno['bbox']
        anno['bbox'] = [x / image_width, y / image_height, w / image_width, h / image_height]
        if 'keypoints' in anno:
          for pidx in range(0, len(anno['keypoints']), 3):
            x, y = anno['keypoints'][pidx:pidx+2]
            anno['keypoints'][pidx:pidx+2] = [x / image_width, y / image_height]

    try:
      response = db.annotation.insert_many(annotations, ordered=False)
      print("Successfully inserted %d annotations" % (len(response.inserted_ids),))
    except BulkWriteError as bwe:
      panic = filter(lambda x: x['code'] != DUPLICATE_KEY_ERROR_CODE, bwe.details['writeErrors'])
      if len(panic) > 0:
        raise
      print("Attempted to insert duplicate annotations, %d new annotations inserted" % (bwe.details['nInserted'],))



  # Insert the licenses
  assert 'licenses' in dataset, "Failed to find `licenses` in dataset object."
  licenses = dataset['licenses']
  print("Inserting %d licenses" % (len(licenses),))
  if len(licenses) > 0:

    # Ensure the license ids are strings
    for lic in licenses:
      lic['id'] = str(lic['id'])

    try:
      response = db.license.insert_many(licenses, ordered=False)
      print("Successfully inserted %d licenses" % (len(response.inserted_ids),))
    except BulkWriteError as bwe:
      panic = filter(lambda x: x['code'] != DUPLICATE_KEY_ERROR_CODE, bwe.details['writeErrors'])
      if len(panic) > 0:
        raise
      print("Attempted to insert duplicate licenses, %d new licenses inserted" % (bwe.details['nInserted'],))


def export_dataset(db, denormalize=False):

  print("Exporting Dataset")

  categories = list(db.category.find(projection={'_id' : False}))
  print("Found %d categories" % (len(categories),))

  images = list(db.image.find(projection={'_id' : False}))
  print("Found %d images" % (len(images),))

  annotations = list(db.annotation.find(projection={'_id' : False}))
  print("Found %d annotations" % (len(annotations),))

  if denormalize:
    image_id_to_w_h = {image['id'] : (float(image['width']), float(image['height']))
                         for image in images}

    for anno in annotations:
      image_width, image_height = image_id_to_w_h[anno['image_id']]
      x, y, w, h = anno['bbox']
      anno['bbox'] = [x * image_width, y * image_height, w * image_width, h * image_height]
      if 'keypoints' in anno:
        for pidx in range(0, len(anno['keypoints']), 3):
          x, y = anno['keypoints'][pidx:pidx+2]
          anno['keypoints'][pidx:pidx+2] = [x * image_width, y * image_height]

  licenses = list(db.license.find(projection={'_id' : False}))
  print("Found %d licenses" % (len(licenses),))

  dataset = {
    'categories' : categories,
    'annotations' : annotations,
    'images' : images,
    'licenses' : licenses
  }

  return dataset

def parse_args():

  parser = argparse.ArgumentParser(description='Dataset loading and exporting utilities.')

  parser.add_argument('-a', '--action', choices=['drop', 'load', 'export'], dest='action',
                      help='The action you would like to perform.', required=True)

  parser.add_argument('-d', '--dataset', dest='dataset_path',
                        help='Path to a json dataset file. Used with the `load` action.', type=str,
                        required=False)

  parser.add_argument('-n', '--normalize', dest='normalize',
                        help='Normalize the annotations prior to inserting them into the database. Used with the `load` action.',
                        required=False, action='store_true', default=False)

  parser.add_argument('-u', '--denormalize', dest='denormalize',
                        help='Denormalize the annotations when exporting the database. Used with the `export` action.',
                        required=False, action='store_true', default=False)

  parser.add_argument('-o', '--output', dest='output_path',
                        help='Save path for the json dataset. Used with the `export` action.', type=str,
                        required=False)


  args = parser.parse_args()
  return args

def main():
  args = parse_args()
  db = get_db()

  action = args.action
  if action == 'drop':
    drop_dataset(db)
  elif action == 'load':
    with open(args.dataset_path) as f:
      dataset = json.load(f)
    ensure_dataset_indices(db)
    load_dataset(db, dataset, normalize=args.normalize)
  elif action == 'export':
    dataset = export_dataset(db, denormalize=args.denormalize)
    with open(args.output_path, 'w') as f:
      json.dump(dataset, f)

if __name__ == '__main__':

  main()