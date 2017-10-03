"""
Start the web server.

$ python run.py \
--debug \
--port 8008
"""

import argparse
import json

from annotation_tools.annotation_tools import app

DEFAULT_PORT = 8003

def parse_args():

  parser = argparse.ArgumentParser(description='Visipedia Annotation Toolkit')

  parser.add_argument('--debug', dest='debug',
                        help='Run in debug mode.',
                        required=False, action='store_true', default=False)

  parser.add_argument('--port', dest='port',
                        help='Port to run on.', type=int,
                        required=False, default=DEFAULT_PORT)

  args = parser.parse_args()
  return args


def main():
  args = parse_args()

  app.run(port=args.port, debug=args.debug)


if __name__ == "__main__":
  main()

