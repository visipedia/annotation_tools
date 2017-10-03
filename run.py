"""
Start the web server.

$ python run.py \
--dataset /data/dataset.json \
--drop \
--port 8008
"""

import argparse
import json

from annotation_tools.annotation_tools import app, get_db
from annotation_tools import db_dataset_utils

DEFAULT_PORT = 8003

def parse_args():

  parser = argparse.ArgumentParser(description='Visipedia Annotation Toolkit')

  parser.add_argument('--dataset', dest='dataset_path',
                        help='Path to a json dataset file.', type=str,
                        required=False, default=False)

  parser.add_argument('--drop', dest='drop',
                        help='Drop the database and reload.',
                        required=False, action='store_true', default=False)

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


  db = get_db()
  if args.drop:
    db_dataset_utils.drop_dataset(db)
  db_dataset_utils.ensure_dataset_indices(db)

  if args.dataset_path:
    with open(args.dataset_path) as f:
      dataset = json.load(f)
    db_dataset_utils.load_dataset(db, dataset)

  app.run(port=args.port, debug=args.debug)


if __name__ == "__main__":
  main()

