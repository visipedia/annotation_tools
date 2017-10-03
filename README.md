# Visipedia Annotation Toolkit

This repository contains a collection of tools for editing and creating COCO style datasets. This repo is a work in progress, you have been warned.

The annotation tools are built on top of [Leaflet.js](http://leafletjs.com/).

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
--database <path to coco style database> \
--port 8008 \
--drop \
--debug
```


