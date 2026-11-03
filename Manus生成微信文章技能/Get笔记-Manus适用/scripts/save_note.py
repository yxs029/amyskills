#!/usr/bin/env python3
import os
import sys
import json
import argparse
import subprocess
import tempfile

def main():
    parser = argparse.ArgumentParser(description="Save a note to Get笔记")
    parser.add_argument("--file", help="Path to the markdown file", required=True)
    parser.add_argument("--title", help="Title of the note", required=True)
    parser.add_argument("--tags", help="Comma-separated tags", default="")
    parser.add_argument("--type", help="Note type", default="plain_text")
    
    args = parser.parse_args()
    
    api_key = os.environ.get("GETNOTE_API_KEY")
    client_id = os.environ.get("GETNOTE_CLIENT_ID")
    
    if not api_key or not client_id:
        print("Error: GETNOTE_API_KEY and GETNOTE_CLIENT_ID environment variables must be set.")
        sys.exit(1)
        
    if not os.path.exists(args.file):
        print(f"Error: File not found: {args.file}")
        sys.exit(1)
        
    with open(args.file, "r", encoding="utf-8") as f:
        content = f.read()
        
    tags = [t.strip() for t in args.tags.split(",")] if args.tags else []
    
    payload = {
        "title": args.title,
        "content": content,
        "note_type": args.type,
        "tags": tags
    }
    
    # Write payload to a temporary file to avoid command line length limits and escaping issues
    with tempfile.NamedTemporaryFile(mode='w', delete=False, encoding='utf-8', suffix='.json') as temp:
        json.dump(payload, temp, ensure_ascii=False)
        temp_path = temp.name
        
    try:
        cmd = [
            "curl", "-s", "--max-time", "30", "-X", "POST",
            "https://openapi.biji.com/open/api/v1/resource/note/save",
            "-H", f"Authorization: {api_key}",
            "-H", f"X-Client-ID: {client_id}",
            "-H", "Content-Type: application/json; charset=utf-8",
            "-d", f"@{temp_path}"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"Error executing curl: {result.stderr}")
            sys.exit(1)
            
        try:
            resp_data = json.loads(result.stdout)
            if resp_data.get("success"):
                print(f"Success! Note ID: {resp_data.get('data', {}).get('note_id')}")
            else:
                print(f"Failed to save note. Response: {result.stdout}")
        except json.JSONDecodeError:
            print(f"Invalid JSON response: {result.stdout}")
            
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)

if __name__ == "__main__":
    main()
