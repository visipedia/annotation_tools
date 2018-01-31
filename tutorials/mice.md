# Mice Tutorial

![interface with mice](assets/mice_tutorial.png?raw=true)

## Setup
The annotation tools rely on [MongoDB](https://www.mongodb.com/) as a database, so you'll need to install that on your machine. Follow the tutorials [here](https://docs.mongodb.com/manual/installation/#tutorials) to install the database. Once installed, make sure that MongoDB is running (i.e. run the `mongod` command).

Clone the Annotation Tools repository on your machine:
```
cd /home/ubuntu
git clone https://github.com/visipedia/annotation_tools.git
```

Install the python requirements:
```
cd /home/ubuntu/annotation_tools
pip install -r requirements.txt
```

## Task
The task for this tutorial is to annotate mice images with bounding boxes and keypoints. Each image will have 2 mice, one that is black and one that is white. When drawing the boxes we would like to distinguish between the two different colored mice. For this task we'll assume that the user will do the annotations themselves, as opposed to using services like Amazon Mechanical Turk.

## Create the Dataset File

We need to create a json dataset file that can be imported into the annotation tools. We do not have any annotations to start from, so we need to fill in the `categories` and `images` fields (we'll leave the `licenses` and `annotations` fields blank). Our dataset json structure will look like:

{
    "categories" : [category info],
    "images" : [image info],
    "annotations" : [],
    "licenses" : []
}

In a python file we can specify the contents of the `categories` array:

```python

keypoints = [
    "nose tip",
    "right ear",
    "left ear",
    "neck",
    "right side body",
    "left side body",
    "tail base",
    "tail middle",
    "tail end"
]

keypoints_style = [
    "#00FF00",
    "#00FFFF",
    "#FFFF00",
    "#FF0000",
    "#FF00FF",
    "#666666",
    "#FF9933",
    "#CCFFCC",
    "#999900"
]

categories = [{
    "id" : "0",
    "name" : "black mouse",
    "supercategory" : "mouse",
    "keypoints" : keypoints,
    "keypoints_style" : keypoints_style
},
{
    "id" : "1",
    "name" : "white mouse",
    "supercategory" : "mouse",
    "keypoints" : keypoints,
    "keypoints_style" : keypoints_style
}]
```
We've created two categories, one for the black mouse and one for the white mouse. We've specified the same keypoints and keypoint styles for each category.

We'll presume that the user has a directory of images that they want to annotate. We want to create the following structure for each image:
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
```
We can leave many of these fields blank, but at the very least we need to specify the image `id` and the `url`. The annotation tool is web based, hence the need for an image *url*. However, we are working with a directory of images stored on the user's local machine, so how do we create a url? We'll start a webserver and serve the images locally using python's `SimpleHTTPServer`. We'll start the server in the image directory, so an image's url will look like `http://localhost:6008/image0.jpg` (assuming that the server is listening on port 6008). We'll use the following the python code to read the images in the directory and create the image structures:
```python

import glob
import os

image_dir_regx = '/home/ubuntu/mice_images/*.jpg'
images = []
for image_path in glob.glob(image_dir_regx):
    image_file_name = os.path.basename(image_path)
    image_id = os.path.splitext(image_file_name)[0]
    image_url = "http://localhost:6008/" + image_file_name
    images.append({
        "id" : image_id,
        "file_name" : image_file_name,
        "url" : image_url
    })

```
Note that we used `6008` as the port when constructing the image urls. When we start the webserver to host the images we'll need to specify this port.

With our `categories` and `images` arrays created, we can save of the json dataset structure:
```python

import json

dataset = {
    "categories" : categories,
    "images" : images,
    "annotations" : [],
    "licenses" : []
}

dataset_file_path = "/home/ubuntu/mouse_dataset.json"
with open(dataset_file_path, 'w') as f:
    json.dump(dataset, f)

```

Let's not forget to start the webserver to serve the images:
```
cd /home/ubuntu/mice_images
python -m SimpleHTTPServer 6008
```
You should be able to open a web browser and navigate to `http://localhost:6008/image0.jpg` and image `image0.jpg` should be rendered (replace `image0.jpg` with a valid image name).

## Import the Dataset
We need to start the annotation tool server:
```
cd /home/ubuntu/annotation_tools
python run.py --port 8008
```
Note that we are using a different port than the one we specified for the webserver that serves the images.

Now we can load in the dataset file that we created:
```
python -m annotation_tools.db_dataset_utils --action load \
--dataset /home/ubuntu/mouse_dataset.json
```
If you get an error regarding connection problems, then please make sure you installed MongoDB and have it running (e.g. see [here](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/#install-mongodb-community-edition-on-ubuntu) for Ubuntu 16.04)

## Edit a Specific Image
To edit a specific image, use the image id to construct the edit url `http://localhost:8008/edit_image/image0`. Opening that url will allow you to add annotations to the image.

## Edit a Sequence of Images
To edit a sequence of images (maybe the first 100 images) use the following url structure `http://localhost:8008/edit_task/?start=0&end=100`. For this query, the images are sorted by their ids, and the first 100 are returned. Each image can then be edited.

## Export the Dataset
Once all of the images have been annotated, the dataset can be exported with the following:
```
python -m annotation_tools.db_dataset_utils --action export \
--output /home/ubuntu/annotated_mouse_dataset.json
```
