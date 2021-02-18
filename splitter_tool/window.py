#this
import sys
from PyQt5.QtGui import QPixmap, QFont, QImage
from PyQt5.QtWidgets import QMainWindow, QApplication, QLabel, QWidget
from PyQt5.QtCore import QPoint
from PyQt5.Qt import Qt
import os
import cv2
import json
import numpy as np

class MainWindow(QMainWindow):

    def __init__(self, args):
        super(MainWindow, self).__init__()
        self.vcap = cv2.VideoCapture(args.video_path)
        self.video_path = args.video_path
        self.rotate = args.rotate
        self.output_directory = args.output_directory
        if self.vcap.isOpened():
            print("opened")
            self.fps = self.vcap.get(cv2.CAP_PROP_FPS)
            self.frameCount = self.vcap.get(cv2.CAP_PROP_FRAME_COUNT)
        self.currFrameId = 0
        self.currFramePath = "frame{}.jpg".format(self.currFrameId)
        print("Setting first frame, ", self.currFrameId)
        self.currFrameId = 0
        self.setFrame(self.currFrameId)

    def keyPressEvent(self, event):

        if event.key() == Qt.Key_Right:
            self.setFrame(self.currFrameId + 1)

        if event.key() == Qt.Key_Up:
            self.setFrame(self.currFrameId + 10)

        if event.key() == Qt.Key_Period:
            self.setFrame(self.currFrameId + 100)

        if event.key() == Qt.Key_5:
            self.setFrame(self.currFrameId + 500)

        if event.key() == Qt.Key_7:
            self.setFrame(self.currFrameId + 700)

        if event.key() == Qt.Key_9:
            self.setFrame(self.currFrameId + 900)

        if event.key() == Qt.Key_Left:
            self.setFrame(self.currFrameId - 1)

        if event.key() == Qt.Key_Down:
            self.setFrame(self.currFrameId - 10)

        if event.key() == Qt.Key_Comma:
            self.setFrame(self.currFrameId - 100)

        if event.key() == Qt.Key_4:
            self.setFrame(self.currFrameId - 400)

        if event.key() == Qt.Key_6:
            self.setFrame(self.currFrameId - 600)

        if event.key() == Qt.Key_8:
            self.setFrame(self.currFrameId - 800)

        if event.key() == Qt.Key_W:
            image = self.setFrame(self.currFrameId)
            outname = "{}/{}.jpg".format(self.output_directory, self.currFrameId)
            cv2.imwrite(outname, image)

        if event.key() == Qt.Key_S:
            self.save()

        if event.key() == Qt.Key_E:
            print("Closing Stumpy")
            self.close()

    def mostRecentFrame(self):
        return 0
        # will need to keep this as an attribute in the info of the video

    def setFrame(self, frameId):
        #print(len(self.data["annotations"]))
        self.currFrameId = frameId
        if frameId > self.frameCount - 1:
            self.currFrameId = self.frameCount - 2
        if frameId < 0:
            self.currFrameId = 0

        self.vcap.set(1, self.currFrameId);
        success, image = self.vcap.read()

        if self.rotate:
            image = cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
        if not success:
            print("Error loading video frame {}".format(self.currFrameId))

        height, width, channel = image.shape
        bytesPerLine = 3 * width
        qImg = QImage(image.data, width, height, bytesPerLine, QImage.Format_BGR888)
        pixmap = QPixmap.fromImage(qImg)

        label = QLabel(self)
        label.setPixmap(pixmap)
        self.setCentralWidget(label)
        # label.setScaledContents(True)
        # label.setFixedSize(500, 800)
        self.resize(pixmap.width(), pixmap.height())
        import glob
        images_in_dir = len(glob.glob1(self.output_directory,"*.jpg"))
        text = "Frame {} | {} Images in directory".format(self.currFrameId, images_in_dir)
        self.setWindowTitle(text)

        return image
