"""
Utilities for populating the dataset for bounding box collection.

You will need to insert an image and category collection into the database.

The instructions dict consists of:
{
  id : str
  title : str
  description : str
  instructions: url
  examples: [url]
}
Where instructions is a url to a website (like a Google Slides presentation) where you have more info about the task.
`examples` is a list of image urls that will be rendered on the start screen. The height for these images should
be 500px.

A bounding box task dict consists of:
{
  id : str
  image_ids : [str]
  instructions_id : str,
  category_id : str
}
Where image ids point to normal image objects.

The result of a worker completing the task is:
{
  time : float
  task_id : str
  date : str
  worker_id : str
  results : [bbox_result]
}
Where bbox_result looks like:
{
  time : float
  annotations : [annotation]
  image : image
}
Where `image` and `annotation` are the standard image and annotation objects.
"""

from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import argparse
import json
import random
import uuid

from annotation_tools.annotation_tools import get_db

def drop_bbox_collections(db):
  db.drop_collection('bbox_task')
  db.drop_collection('bbox_task_instructions')
  db.drop_collection('bbox_task_result')

def ensure_bbox_indices(db):
  db.bbox_task.create_index("id", unique=True)
  db.bbox_task_instructions.create_index("id", unique=True)


def insert_bbox_tasks(db, tasks):
  """
  Args:
    db: a pymongo database connection
    tasks: [{
      id : task_id,
      image_ids : [image_ids],
      instructions_id : instructions_id,
      category_id : str
    }] A list of bbox task dicts.
  """
  try:
    response = db.bbox_task.insert_many(tasks, ordered=False)
  except:
    pass
  return response

def insert_bbox_task_instructions(db, task_instructions):
  """ Store the instructions for the bbox task.
  Args:
    task_instructions: [{
      'id' :
      'title' :
      'description' :
      'instructions':
      'examples'
    }] A list of bbox task instructions
  """
  try:
    response = db.bbox_task_instructions.insert_many(task_instructions, ordered=False)
  except:
    pass
  return response

def create_bbox_tasks_for_all_images(db, category_id, instructions_id, num_images_per_task=20):
  """Insert all images into a bounding box task. This is a convenience function.
  Returns:
    [<bbox task dict>] a list of the tasks created.
  """

  ensure_bbox_indices(db)

  images = list(db.image.find({}, {'id' : True}))
  image_ids = [image['id'] for image in images]
  random.shuffle(image_ids)

  image_id_groups = [image_ids[idx:idx+num_images_per_task]
                for idx in range(0, len(image_ids), num_images_per_task)]

  bbox_tasks = []
  for group in image_id_groups:
    task_id = str(uuid.uuid1())
    bbox_tasks.append({
      'id' : task_id,
      'image_ids': group,
      'instructions_id' : instructions_id,
      'category_id' : category_id
    })

  insert_bbox_tasks(db, bbox_tasks)

  return bbox_tasks

def load_tasks(db, task_data):
  """
  task_data{
    'tasks' : [bbox_task],
    'instructions' : [bbox_task_instructions]
  }
  """
  assert 'tasks' in task_data,  "Failed to find `tasks` in task_data object."

  if 'instructions' in task_data:
    instructions = task_data['instructions']
    print("Inserting %d instructions." % (len(instructions),))
    response = insert_bbox_task_instructions(db, instructions)
    print("Successfully inserted %d instuctions." % (len(response.inserted_ids),))

  tasks = task_data['tasks']
  print("Inserting %d tasks." % (len(tasks),))
  response = insert_bbox_tasks(db, tasks)
  print("Successfully inserted %d tasks." % (len(response.inserted_ids),))

def export_task_results(db, task_data=None, denormalize=False):
  """ Export the bbox task results. Saves a list of task results to `output_path`.
  Args:
    task_data: Use this to specify which task results to export.
    denormalize: Should the annotations be stored in image coordinates?
  """
  if task_data != None:
    assert 'tasks' in task_data,  "Failed to find `tasks` in task_data object."
    task_ids = list(set([task['id'] for task in task_data['tasks']]))
    task_results = list(db.bbox_task_result.find({'task_id' : {"$in" : task_ids}}, projection={'_id' : False}))
  else:
    task_results = list(db.bbox_task_result.find(projection={'_id' : False}))

  if denormalize:
    for task_result in task_results:
      for image_result in task_result['results']:
        image = image_result['image']
        width = image['width']
        height = image['height']
        for anno in image_result['annotations']:
          x, y, w, h = anno['bbox']
          anno['bbox'] = [x * width, y * height, w * width, h * height]

  return task_results

def parse_args():

  parser = argparse.ArgumentParser(description='Dataset loading and exporting utilities.')

  parser.add_argument('-a', '--action', choices=['drop', 'load', 'export'], dest='action',
                      help='The action you would like to perform.', required=True)

  parser.add_argument('-t', '--tasks', dest='task_path',
                        help='Path to a json task file containing bbox tasks and (optionally) instructions. Used with the `load` and `export` action.', type=str,
                        required=False, default=None)

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
    drop_bbox_collections(db)
  elif action == 'load':
    with open(args.task_path) as f:
      task_data = json.load(f)
    ensure_bbox_indices(db)
    load_tasks(db, task_data)
  elif action == 'export':
    if args.task_path != None:
      with open(args.task_path) as f:
        task_data = json.load(f)
    else:
      task_data = None
    results = export_task_results(db, task_data, denormalize=args.denormalize)
    with open(args.output_path, 'w') as f:
      json.dump(results, f)

if __name__ == '__main__':

  main()

