# Visipedia Annotation Toolkit

This repository contains a collection of tools for editing and creating [COCO style datasets](http://cocodataset.org/#download). This repo is a work in progress.

The annotation tools are built on top of [Leaflet.js](http://leafletjs.com/) and [Leaflet.draw](https://leaflet.github.io/Leaflet.draw/docs/leaflet-draw-latest.html).

## Capabilities:
* Load and visualize a COCO style dataset
* Edit Class Labels
* Edit Bounding Boxes
* Edit Keypoints
* Export a COCO style dataet
* Bounding Box Tasks for Amazon Mechanical Turk

## Not Implemented:
* Edit Segmentations
* Keypoint tasks for Amazon Mechanical Turk
* Class label tasks for Amazon Mechanical Turk
* Segmentation tasks for Amazon Mechanical Turk

# Requirements

Make sure that you have installed mongodb. We currently develop with node v6.11.0 and Python 2.7.

# Developement setup

Install python packages:
```
$ pip install -r requirements.txt
```

Install node modules (both production and development):
```
$ npm install
```

Watch for javascript changes and recompile the app (this generates `app.bundle.js` in `annotation_tools/static`):
```
$ npm run watch
```

Start the web server:
```
$ python run.py \
--port 8008 \
--debug
```

# Dataset Format
We use a slightly modified COCO dataset format:
```
{
"images" : [image],
"annotations" : [annotation],
"categories" : [category],
"licenses" : [license]
}

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

```

The biggest change that we have made is storing the annotations in normalized coordinates (each x value is divided by the width of the image, and each y value is divided by the height of the image). This is more convenient for rendering the annotations on resized images. We also use strings to store the ids rather than integers.

`coco_url` & `flickr_url` have been remapped to `url`.

`rights_holder` is a string that can hold the photographer's name.

`keypoints_style` is an array of css color values for the different keypoints of the class (e.g. `'#46f0f0'`).

# Dataset Loading and Exporting

We use the modified COCO dataset format as the "schema" for the the MongoDB database. Loading a dataset will create 4 collections: `category`, `image`, `annotation`, and `license`.

We can load the original COCO dataset out of the box. However, we need to tell the code to normalize the annotations by passing the `--normalize` command line argument. Further, the code will check to see if `coco_url` is present and will create a `url` field with the same value.

Load a dataset:
```
python -m annotation_tools.db_dataset_utils --action load \
--dataset ~/Downloads/annotations/person_keypoints_val2017.json \
--normalize
```

After we have edited the dataset, we can export it. This will produce a json file that can be used as a datatset file to train a computer vision model. By default, the code will export *noramalized* annotations, we can export denomalized coordinates by passing the `--denormalize` command line argument.

Export a dataset:
```
python -m annotation_tools.db_dataset_utils --action export \
--output ~/Downloads/annotations/updated_person_keypoints_val2017.json \
--denormalize
```

We provide a convenience function to clear the collections that have been created when loading a dataset:
```
python -m annotation_tools.db_dataset_utils --action drop
```

# Hosting Images Locally

It might be the case that the images you want to edit are on your local machine and not accessible via a url. In this case, you can use python's SimpleHTTPServer to start a local webserver to serve the images directly from your machine. If the images are located in `/home/gvanhorn/images` then you can:
```
cd /home/gvanhorn
python -m SimpleHTTPServer 8007
```
This starts a webserver on port 8007 that can serve files from the `/home/gvanhorn` directory. You can now access images via the browser by going to `localhost:8007/images/397133.jpg`, where `397133.jpg` is an image file in `/home/gvanhorn/images`. Now you can create a json dataset file that has `localhost:8007/images/397133.jpg` in the `url` field for the image with id `397133`. As this technique makes all files in the directory `/home/gvanhorn` accessible, this should be used with caution.

# Editing an Image

The edit tool is meant to be used by a "super user." It is a convenient tool to visualize and edit all annotations on an image. All changes will overwrite the annotations in the database. To edit a specific image, use the image id (which you specified in the dataset file that you loaded in the previous section) and go to the url `localhost:8008/edit_image/397133`, where the image id is `397133` in this case. Make any modificaiton to the image that you need to and save the annotations. Note that when saving the annotations you directly overwrite the previous version of the annotations.

We currently support editing the class labels, bounding boxes, and keypoints. Editing segmentations is not currently supported.

# Collecting Bounding Boxes

We support creating bounding box tasks, where each task is composed of a group of images that needed to be annotated with bounding boxes for a *single* category. Each task has a specific `id` and is accessible via `localhost:8008/bbox_task/0a95f07a`, where `0a95f07a` is the task id. Similar to datasets, you'll need to create a json file that specifies the bounding box tasks and then load that file into the tool.

Data format:
```
{
  'instructions' : [bbox_task_instructions],
  'tasks' : [bbox_task]
}

bbox_task_instructions{
  id : str
  title : str
  description : str
  instructions: url
  examples: [url]
}

bbox_task{
  id : str
  image_ids : [str]
  instructions_id : str,
  category_id : str
}
```
The `bbox_task_instructions` contains fields that hold instruction information to show to the worker.  The `examples` list should contain urls to example images. These images should have a height of 500px and will be rendered on the task start screen. `instructions` should point to an external page that contains detailed information for your task. For example you can use Google Slides to describe the task in detail and have more examples.

`bbox_task` contains a list of image ids (`image_ids`) that should be annotated with bounding boxes. The `instruction_id` field should be a valid bbox_task_instructions `id`. The `category_id` should be valid category that was created when loading a dataset. The workers will be asked to draw boxes around that category for each image in the task.

Once you have created a json file you can load it:
```
python -m annotation_tools.db_bbox_utils --action load \
--tasks ~/Desktop/bbox_tasks.json
```

The task can be accessed by going to the url `localhost:8008/bbox_task/0a95f07a`, where `0a95f07a` is a `bbox_task` `id` that you specified in the json file that was loaded.

When a worker finishes a task, the following result structure will be saved in the database:
```
bbox_task_result{
  time : float
  task_id : str
  date : str
  worker_id : str
  results : [bbox_result]
}

bbox_result{
  time : float
  annotations : [annotation]
  image : image
}
```
Where `annotation` is defined above. 

These results can be exported to a json file with:
```
python -m annotation_tools.db_bbox_utils --action export \
--output ~/Desktop/bbox_task_results.json \
--denormalize
```
If you only want to export a specific set of results, you can pass in the bounding box task file that contains the tasks you want results for:
```
python -m annotation_tools.db_bbox_utils --action export \
--tasks ~/Desktop/bbox_tasks.json \
--output ~/Desktop/bbox_task_results.json \
--denormalize
```

We provide a convenience function to clear all collections associated with the bounding boxes tasks:
```
python -m annotation_tools.db_bbox_utils --action drop
```
