"""
Flask web server.
"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import datetime
import json
import os

from flask import Flask, render_template, jsonify, request
from flask_pymongo import PyMongo
from bson import json_util

app = Flask(__name__)
app.config.from_object('annotation_tools.default_config')
if 'VAT_CONFIG' in os.environ:
  app.config.from_envvar('VAT_CONFIG')
mongo = PyMongo(app)

def get_db():
  """ Return a handle to the database
  """
  with app.app_context():
    db = mongo.db
    return db

############### Dataset Utilities ###############

@app.route('/')
def home():
  return render_template('layout.html')


@app.route('/edit_image/<image_id>')
def edit_image(image_id):
  """ Edit a single image.
  """

  image = mongo.db.image.find_one_or_404({'id' : image_id})
  annotations = list(mongo.db.annotation.find({'image_id' : image_id}))
  categories = list(mongo.db.category.find())

  image = json_util.dumps(image)
  annotations = json_util.dumps(annotations)
  categories = json_util.dumps(categories)

  if request.is_xhr:
    # Return just the data
    return jsonify({
      'image' : json.loads(image),
      'annotations' : json.loads(annotations),
      'categories' : json.loads(categories)
    })
  else:
    # Render a webpage to edit the annotations for this image
    return render_template('edit_image.html', image=image, annotations=annotations, categories=categories)

@app.route('/edit_task/')
def edit_task():
  """ Edit a group of images.
  """
  start=0
  if 'start' in request.args:
    start = int(request.args['start'])
  end=None
  if 'end' in request.args:
    end = int(request.args['end'])

  images = list(mongo.db.image.find(projection={'id' : True, '_id' : False}))
  if end is None:
    images = images[start:]
  else:
    images = images[start:end]
  image_ids = [image['id'] for image in images]

  categories = list(mongo.db.category.find(projection={'_id' : False}))

  return render_template('edit_task.html',
    task_id=1,
    image_ids=image_ids,
    categories=categories,
  )

@app.route('/annotations/save', methods=['POST'])
def save_annotations():
  """ Save the annotations. This will overwrite annotations.
  """
  annotations = json_util.loads(json.dumps(request.json['annotations']))

  for annotation in annotations:
    # Is this an existing annotation?
    if '_id' in annotation:
      if 'deleted' in annotation and annotation['deleted']:
        mongo.db.annotation.delete_one({'_id' : annotation['_id']})
      else:
        result = mongo.db.annotation.replace_one({'_id' : annotation['_id']}, annotation)
    else:
      if 'deleted' in annotation and annotation['deleted']:
        pass # this annotation was created and then deleted.
      else:
        # This is a new annotation
        if 'id' not in annotation:
          insert_res = mongo.db.annotation.insert_one(annotation, bypass_document_validation=True)
          anno_id = insert_res.inserted_id
          mongo.db.annotation.update_one({'_id' : anno_id}, {'$set' : {'id' : str(anno_id)}})
        else:
          insert_res = mongo.db.insert_one(annotation)

  return ""

#################################################

################## BBox Tasks ###################

@app.route('/bbox_task/<task_id>')
def bbox_task(task_id):
  """ Get the list of images for a bounding box task and return them along
  with the instructions for the task to the user.
  """

  bbox_task = mongo.db.bbox_task.find_one_or_404({'id' : task_id})
  task_id = str(bbox_task['id'])
  tasks = []
  for image_id in bbox_task['image_ids']:
    image = mongo.db.image.find_one_or_404({'id' : image_id}, projection={'_id' : False})
    tasks.append({
      'image' : image,
      'annotations' : []
    })

  category_id = bbox_task['category_id']
  categories = [mongo.db.category.find_one_or_404({'id' : category_id}, projection={'_id' : False})]
  #categories = json.loads(json_util.dumps(categories))

  task_instructions_id = bbox_task['instructions_id']
  task_instructions = mongo.db.bbox_task_instructions.find_one_or_404({'id' : task_instructions_id}, projection={'_id' : False})

  return render_template('bbox_task.html',
    task_id=task_id,
    task_data=tasks,
    categories=categories,
    mturk=True,
    task_instructions=task_instructions
  )

@app.route('/bbox_task/save', methods=['POST'])
def bbox_task_save():
  """ Save the results of a bounding box task.
  """

  task_result = json_util.loads(json.dumps(request.json))

  task_result['date'] = str(datetime.datetime.now())

  insert_res = mongo.db.bbox_task_result.insert_one(task_result, bypass_document_validation=True)

  return ""

#################################################