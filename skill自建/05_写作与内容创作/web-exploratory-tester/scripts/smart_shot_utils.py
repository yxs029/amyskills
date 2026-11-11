#!/usr/bin/env python3
"""
Smart screenshot utilities for web-exploratory-tester.
Prevents blank screenshots and handles viewport timeout issues.

Forged in SRMPRO testing session (2026-07-08) to solve:
- Blank screenshots from early capture
- Playwright viewport timeout for elements outside visible area
- Selector assumptions causing false negatives
"""

import os
import time
from pathlib import Path

# Global counter for sequential naming
shot_counter = 0

def wait_for_page_ready(page, timeout=30):
    """Intelligent page load detection - three layer strategy.
    
    Layer 1: networkidle (wait for network to settle)
    Layer 2: selector wait (wait for key DOM elements)  
    Layer 3: DOM stability (wait for 2 consecutive equal measurements)
    """
    # Layer 1: Wait for network idle
    try:
        page.wait_for_load_state('networkidle', timeout=timeout * 1000)
    except Exception:
        pass  # Continue on timeout - use fallback
    
    # Layer 2: Wait for key DOM elements
    selectors = ['.el-table', '.el-menu', '.el-input', '.el-button',
                 '.el-form', 'input', 'button', 'body']
    for sel in selectors:
        try:
            page.wait_for_selector(sel, timeout=8000)
            break
        except Exception:
            continue
    
    # Layer 3: DOM stability detection
    prev_len = -1
    stable_count = 0
    for _ in range(10):
        try:
            curr_len = page.evaluate("() => document.body ? document.body.innerHTML.length : 0")
        except Exception:
            curr_len = 0
        if curr_len == prev_len and curr_len > 100:
            stable_count += 1
            if stable_count >= 2:
                break
        else:
            stable_count = 0
        prev_len = curr_len
        time.sleep(0.5)
    
    # Extra wait for frontend frameworks
    time.sleep(1)

def smart_shot(page, tc_id, step, desc, max_retries=3, shot_dir="./screenshots"):
    """Screenshot after page ready + validate size + auto-retry on blank.
    
    Blank detection: <10KB = blank page (11KB threshold validated on SRMPRO)
    Returns filepath even on blank (caller decides action)
    """
    global shot_counter
    shot_counter += 1
    filename = f"{tc_id}_step{step}_{desc}.png"
    filepath = os.path.join(shot_dir, filename)
    
    Path(shot_dir).mkdir(parents=True, exist_ok=True)
    
    # Wait for page ready FIRST
    wait_for_page_ready(page, timeout=30)
    
    for attempt in range(max_retries):
        try:
            page.screenshot(path=filepath, full_page=False, timeout=15000)
            size = os.path.getsize(filepath)
            
            if size >= 10000:  # Normal screenshot (SRMPRO verified 11KB threshold)
                log(f"  📸 {filename} ({size:,}B) ✅")
                return filepath
            elif attempt < max_retries - 1:
                log(f"  📸 {filename} ({size:,}B) ⚠️ blank, retry {attempt+1}/{max_retries}")
                time.sleep(2)
            else:
                log(f"  📸 {filename} ({size:,}B) ❌ blank after {max_retries} retries")
                return filepath
        except Exception as e:
            if attempt < max_retries - 1:
                log(f"  📸 {filename} screenshot error, retry: {e}")
                time.sleep(2)
            else:
                log(f"  📸 {filename} failed after {max_retries} attempts: {e}")
                return filepath
    return filepath

def js_click(page, text):
    """Click element via JS to bypass Playwright viewport restrictions.
    
    Use when Playwright reports 'element is outside of the viewport'
    or 'element is not visible'. JS click bypasses viewport checks.
    """
    result = page.evaluate(f"""() => {{
        const btns = [...document.querySelectorAll('button')];
        const target = btns.find(b => b.textContent.includes('{text}'));
        if (target) {{ target.click(); return true; }}
        const all = [...document.querySelectorAll('span, a, div')];
        const t2 = all.find(e => e.textContent.trim() === '{text}' && e.offsetParent !== null);
        if (t2) {{ t2.click(); return true; }}
        return false;
    }}""")
    return result

def probe_inputs(page):
    """Discover all visible inputs on page - don't assume placeholder values.
    
    Returns list of input metadata for selector validation.
    Prevents false negatives from wrong selector assumptions.
    """
    return page.evaluate("""() => {
        return Array.from(document.querySelectorAll('input.el-input__inner, input'))
            .filter(i => i.offsetParent !== null)
            .map(i => ({
                placeholder: i.placeholder,
                type: i.type,
                value: i.value,
                className: i.className.substring(0, 50),
                rect: {
                    x: Math.round(i.getBoundingClientRect().x),
                    y: Math.round(i.getBoundingClientRect().y),
                    w: Math.round(i.getBoundingClientRect().width),
                    h: Math.round(i.getBoundingClientRect().height)
                }
            }));
    }""")

def log(msg):
    """Simple logging helper."""
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

if __name__ == "__main__":
    # Demo usage
    print("Smart screenshot utilities loaded.")
    print("Usage: from smart_shot_utils import smart_shot, js_click, probe_inputs, wait_for_page_ready")
    print("\nScreenshot size thresholds (SRMPRO validated):")
    print("  < 5KB   - Complete blank")
    print("  5-10KB  - Near-blank") 
    print("  10KB+   - Content page (normal)")