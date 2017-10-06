# Visipedia Annotation Toolkit

This repository contains a collection of tools for editing and creating COCO style datasets. This repo is a work in progress, you have been warned.

The annotation tools are built on top of [Leaflet.js](http://leafletjs.com/) and [Leaflet.draw](https://leaflet.github.io/Leaflet.draw/docs/leaflet-draw-latest.html).

# Requirements

Make sure that you have installed `mongodb`.

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

`coco_url` / `flickr_url` has been remapped to `url`.

`rights_holder` is a string that can hold the photographer's name.

`keypoints_style` is an array of css color values for the different keypoints of the class (e.g. `'#46f0f0'`).

# Dataset Loading and Exporting

We use the modified COCO dataset format as the "schema" for the the MongoDB database. Loading a dataset will create 4 collections: `category`, `image`, `annotation`, and `license`.

We can load the original COCO dataset out of the box. However, the annotations should be normalized and a proper url field will be added.

Load a dataset:
```
python -m annotation_tools.db_dataset_utils --action load \
--dataset ~/Downloads/annotations/person_keypoints_val2017.json \
--normalize
```

Export a dataset:
```
python -m annotation_tools.db_dataset_utils --action export \
--output ~/Downloads/annotations/updated_person_keypoints_val2017.json \
--denormalize
```

Clear the database:
```
python -m annotation_tools.db_dataset_utils --action drop
```

# Editing an Image

Use the image id and go to the url `localhost:8008/edit_image/397133`, where the image id is `397133` in this case. Make any modificaiton to the image that you need to and save the annotations. Note that when saving the annotations you directly overwrite the previous version of the annotations.