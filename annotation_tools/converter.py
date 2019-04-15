import json
from typing import List, Dict, Any
import os
import urllib
from urllib.parse import quote, quote_plus
import glob
from PIL import Image

S3_PREFIX = "https://s3.amazonaws.com/pai-datastore/images"
NUM_OF_KEYPOINTS = 18
COCO_HEADER = {"info": {"description": "Passenger Labeling 1"},
               "licenses": [
                   {
                       "id": 1,
                       "name": "Proprietary",
                       "url": ""
                   }
               ],
               "categories": [
                   {
                       "supercategory": "person",
                       "id": 1,
                       "name": "person",
                       "keypoints": [
                           "nose",
                           "neck",
                           "right_shoulder",
                           "right_elbow",
                           "right_wrist",
                           "left_shoulder",
                           "left_elbow",
                           "left_wrist",
                           "right_hip",
                           "right_knee",
                           "right_ankle",
                           "left_hip",
                           "left_knee",
                           "left_ankle",
                           "right_eye",
                           "left_eye",
                           "right_ear",
                           "left_ear"
                       ],
                       "skeleton": [
                           [
                               0,
                               14
                           ],
                           [
                               14,
                               16
                           ],
                           [
                               0,
                               15
                           ],
                           [
                               15,
                               17
                           ],
                           [
                               0,
                               1
                           ],
                           [
                               1,
                               2
                           ],
                           [
                               2,
                               3
                           ],
                           [
                               3,
                               4
                           ],
                           [
                               1,
                               5
                           ],
                           [
                               5,
                               6
                           ],
                           [
                               6,
                               7
                           ],
                           [
                               1,
                               8
                           ],
                           [
                               8,
                               9
                           ],
                           [
                               9,
                               10
                           ],
                           [
                               1,
                               11
                           ],
                           [
                               11,
                               12
                           ],
                           [
                               12,
                               13
                           ]
                       ]
                   }
               ]
               }


def body_25_to_coco_18(keypoints: List[float]) -> List[float]:
    """
    noqa

    BODY_25 to COCO_18 key mapping based on the following:
    https://github.com/CMU-Perceptual-Computing-Lab/openpose/blob/master/doc/output.md

    The onlny difference is that COCO_18 doesn't have the MidHip (#8), Toes,
    Heels and Background (#19-#25) keypoints.

    """
    return keypoints[:8 * 3] + keypoints[9 * 3:19 * 3]


def keypoints_to_visible(keypoints: List[float]) -> List[float]:
    """
    Visipedia uses a 3rd item for points, which indicates whether the point is
    visible or not. Thus, we replace all the confidence values > 0 of the points
    to VISIBLE, and all points with confidence value == 0 as unlabeled.

    """
    VISIBLE = 2
    k = keypoints[:]
    for i in range(NUM_OF_KEYPOINTS):
        confidence_idx = i * 3 + 2
        if k[confidence_idx] > 0:
            k[confidence_idx] = VISIBLE
        else:
            k[confidence_idx] = 0

    return k


def get_bbox(keypoints: List[float], max_width, max_height) -> List[float]:
    if len(keypoints) < 3:
        return []

    xs, ys = [], []
    for i in range(NUM_OF_KEYPOINTS):
        x, y, visibility = keypoints[i * 3:i * 3 + 3]
        if visibility != 0:
            xs.append(x)
            ys.append(y)

    left = max(min(xs) - 100, 0)  # The shift is experimental
    top = max(min(ys) - 200, 0)  # The shift accounts for eye to head distance
    width = min(max(xs) - left, max_width)
    height = min(max(ys) - top, max_height)
    return [left, top, width, height]


def convert_json(file_path: str, image_id: int):
    with open(file_path) as fp:
        openpose_json = json.load(fp)
        file_name = os.path.basename(file_path)[:-15]
        img_path = f"/Users/ali/martin-jsons/images/{file_name}.jpg"
        im = Image.open(img_path)
        width, height = im.size
        # im.thumbnail((1280, 960))
        # im.save(img_path, "JPEG")
        url = f'{S3_PREFIX}/{quote_plus(file_name)}.jpg'
        out = {
            "images": [{"id": image_id,
                        "url": url,
                        "width": width,
                        "height": height,
                        }],
            "annotations": []}

        id = 1
        for people in openpose_json["people"]:
            keypoints = body_25_to_coco_18(people["pose_keypoints_2d"])
            keypoints = keypoints_to_visible(keypoints)
            assert len(keypoints) == NUM_OF_KEYPOINTS * 3, len(keypoints)
            annotation = {
                "id": f'{image_id}_annotat_{id}',
                "image_id": image_id,
                "num_keypoints": NUM_OF_KEYPOINTS,
                "iscrowd": 0,
                "category_id": 1,
                "keypoints": keypoints,
                "bbox": get_bbox(keypoints, width, height),
                "updated_at": None
            }
            out["annotations"].append(annotation)
            id += 1

        return out


def convert_files(keypoints_path: str, output_file: str):
    id = 1
    d: Dict[str, object] = {"images": [],
                            "annotations": []}

    for filepath in glob.iglob(f'{keypoints_path}/*.json'):
        single_row = convert_json(filepath, id)
        d["images"] += single_row["images"]
        d["annotations"] += single_row["annotations"]
        id += 1
        if id % 100 == 0:
            print(f'{id} images processed')

    d.update(COCO_HEADER)
    with open(output_file, 'w') as fp:
        json.dump(d, fp)

    return d
