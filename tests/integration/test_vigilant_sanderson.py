
import urllib.request
import json
import os
import sys

# Configuration
API_URL = "http://localhost:8001/chat/completions/stream"
# The path where we cloned the repo on the host machine
REPO_PATH = "/tmp/website-vigilant-sanderson"

def get_file_tree(path):
    file_tree = []
    if not os.path.exists(path):
        print(f"Error: Repo path {path} does not exist")
        return ""
        
    for root, dirs, files in os.walk(path):
        # Exclude hidden files/dirs
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        files = [f for f in files if not f.startswith('.')]
        
        rel_root = os.path.relpath(root, path)
        if rel_root == ".":
            for f in files:
                file_tree.append(f)
        else:
            for f in files:
                file_tree.append(os.path.join(rel_root, f))
    return "\n".join(sorted(file_tree))

def get_readme(path):
    readme_path = os.path.join(path, "README.md")
    if os.path.exists(readme_path):
        with open(readme_path, "r", encoding="utf-8") as f:
            return f.read()
    return ""

def test_wiki_generation():
    print(f"Generating file tree and README from {REPO_PATH}...")
    file_tree = get_file_tree(REPO_PATH)
    readme = get_readme(REPO_PATH)
    
    if not file_tree:
        print("❌ Failed to get file tree. Make sure the repo is cloned to /tmp/website-vigilant-sanderson")
        sys.exit(1)
    
    prompt = f"""
Analyze this GitHub repository REDFOX1899/website-vigilant-sanderson and create a wiki structure for it.

1. The complete file tree of the project:
<file_tree>
{file_tree}
</file_tree>

2. The README file of the project:
<readme>
{readme}
</readme>

I want to create a wiki for this repository. Determine the most logical structure for a wiki based on the repository's content.

IMPORTANT: The wiki content will be generated in English language.

When designing the wiki structure, include pages that would benefit from visual diagrams.

Return your analysis in the following XML format:

<wiki_structure>
  <title>[Overall title for the wiki]</title>
  <description>[Brief description of the repository]</description>
  <sections>
    <section id="section-1">
      <title>[Section title]</title>
      <pages>
        <page_ref>page-1</page_ref>
      </pages>
    </section>
  </sections>
  <pages>
    <page id="page-1">
      <title>[Page title]</title>
      <description>[Brief description]</description>
      <importance>high</importance>
      <relevant_files>
        <file_path>[Path]</file_path>
      </relevant_files>
      <parent_section>section-1</parent_section>
    </page>
  </pages>
</wiki_structure>
"""
    
    payload = {
        "repo_url": "https://github.com/REDFOX1899/website-vigilant-sanderson",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "type": "github",
        "provider": "google",
        "model": "gemini-2.5-flash" # using Google Gemini as requested
    }
    
    print("Sending request to API...")
    req = urllib.request.Request(
        API_URL, 
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            print(f"Response code: {response.getcode()}")
            response_text = ""
            for line in response:
                decoded_line = line.decode('utf-8')
                response_text += decoded_line
                
        print("\n--- Response (First 500 chars) ---")
        print(response_text[:500] + "..." if len(response_text) > 500 else response_text)
        print("----------------")
        
        # Check for XML validity (basic check)
        start_tag = "<wiki_structure>"
        end_tag = "</wiki_structure>"
        
        if start_tag in response_text and end_tag in response_text:
            # Check if there is anything BEFORE the start tag (excluding whitespace)
            preamble = response_text.split(start_tag)[0].strip()
            if preamble:
                print(f"⚠️  Warning: Found Content before XML start tag: '{preamble[:100]}...'")
                print("This might cause 'No valid XML found' errors if the parser is strict.")
            
            # Check if there is markdown code block wrapping
            if "```xml" in response_text or "```" in response_text:
                print("⚠️  Warning: Response contains markdown code blocks (```).")
            
            print("✅ Valid XML tags found in response!")
            
            # Try to save the response to a file for inspection
            with open("test_response.xml", "w") as f:
                f.write(response_text)
            print("Response saved to test_response.xml")
            
        else:
            print("❌ No valid XML tags found in response.")
            print("Response might contain markdown code blocks or conversational text.")
            
    except urllib.error.URLError as e:
        print(f"❌ Connection Error: {e}")
        print("Make sure docker-compose is running and exposing port 8001.")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_wiki_generation()
