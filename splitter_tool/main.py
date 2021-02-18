#this
import argparse
import json
import os
import shutil
import sys

import cv2
from PyQt5.QtWidgets import QApplication

from window import MainWindow


def setup(args):
    # if os.path.exists(folderName):
    #     shutil.rmtree(folderName)
    # os.mkdir(folderName)

    vcap = cv2.VideoCapture(args.video_path)

    # create annotation json file
    if vcap.isOpened():
        # video attributes
        filename = args.video_path
        width = vcap.get(cv2.CAP_PROP_FRAME_WIDTH)
        height = vcap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        fps = vcap.get(cv2.CAP_PROP_FPS)
        frameCount = vcap.get(cv2.CAP_PROP_FRAME_COUNT)
        recentAnnotation = 0


def main(args):
    app = QApplication(sys.argv)
    w = MainWindow(args)
    w.show()
    sys.exit(app.exec_())


# Driver Code
if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('video_path', type=str, help="Path to video file")
    parser.add_argument('output_directory', type=str,help="Path to folder of images")
    parser.add_argument("--rotate", action="store_true", help="If it is a mobile video, rotate")

    args = parser.parse_args()
    images_folder_path = setup(args)
    main(args)
