import os
import shutil
import glob
import argparse
from datetime import datetime

# Default configuration (can be overridden by args)
DEFAULT_DEST_DIR = "antigravity_walkthrough"

def archive_walkthroughs(source_dir, dest_dir):
    # Create destination directory if it doesn't exist
    if not os.path.exists(dest_dir):
        os.makedirs(dest_dir)
        print(f"Created directory: {dest_dir}")

    # Find all walkthrough markdown files
    pattern = os.path.join(source_dir, "walkthrough*.md")
    files = glob.glob(pattern)

    if not files:
        print(f"No walkthrough files found in {source_dir} to archive.")
        return

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    for src_path in files:
        filename = os.path.basename(src_path)
        name, ext = os.path.splitext(filename)
        
        # Create new filename with timestamp
        new_filename = f"{name}_{timestamp}{ext}"
        dest_path = os.path.join(dest_dir, new_filename)

        try:
            shutil.copy2(src_path, dest_path)
            print(f"Copied: {filename} -> {dest_path}")
        except Exception as e:
            print(f"Error copying {filename}: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Archive walkthrough artifacts.")
    parser.add_argument("--source", required=True, help="Source directory containing walkthrough files")
    parser.add_argument("--dest", default=DEFAULT_DEST_DIR, help="Destination directory")
    
    args = parser.parse_args()
    
    archive_walkthroughs(args.source, args.dest)
