//! Native grep module — in-process ripgrep using grep-* crates.
//! Provides parallel file content search with .gitignore respect.

use napi_derive::napi;
use napi::bindgen_prelude::*;

#[napi(object)]
pub struct GrepOptions {
    pub pattern: String,
    pub root_dir: String,
    pub is_regex: Option<bool>,
    pub case_insensitive: Option<bool>,
    pub max_results: Option<u32>,
    pub context_before: Option<u32>,
    pub context_after: Option<u32>,
    pub glob_filter: Option<String>,
    pub file_type: Option<String>,
    pub respect_gitignore: Option<bool>,
}

#[napi(object)]
pub struct GrepMatch {
    pub path: String,
    pub line_number: u32,
    pub line_content: String,
    pub context_before: Option<Vec<String>>,
    pub context_after: Option<Vec<String>>,
}

#[napi(object)]
pub struct GrepResult {
    pub matches: Vec<GrepMatch>,
    pub files_searched: u32,
    pub truncated: bool,
}

#[napi]
pub fn grep_search(options: GrepOptions) -> Result<GrepResult> {
    use grep_regex::RegexMatcher;
    use grep_searcher::Searcher;
    use grep_searcher::sinks::UTF8;
    use ignore::WalkBuilder;
    use std::sync::{Arc, Mutex};

    let pattern = &options.pattern;
    let case_insensitive = options.case_insensitive.unwrap_or(false);
    let max_results = options.max_results.unwrap_or(250) as usize;
    let respect_gitignore = options.respect_gitignore.unwrap_or(true);

    let matcher = if options.is_regex.unwrap_or(true) {
        RegexMatcher::new_line_matcher(pattern)
    } else {
        RegexMatcher::new_line_matcher(&regex::escape(pattern))
    }.map_err(|e| Error::from_reason(format!("Invalid pattern: {}", e)))?;

    let matches = Arc::new(Mutex::new(Vec::new()));
    let files_searched = Arc::new(Mutex::new(0u32));

    let walker = WalkBuilder::new(&options.root_dir)
        .git_ignore(respect_gitignore)
        .hidden(true)
        .build_parallel();

    walker.run(|| {
        let matcher = matcher.clone();
        let matches = Arc::clone(&matches);
        let files_searched = Arc::clone(&files_searched);

        Box::new(move |entry| {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => return ignore::WalkState::Continue,
            };

            if !entry.file_type().map_or(false, |ft| ft.is_file()) {
                return ignore::WalkState::Continue;
            }

            *files_searched.lock().unwrap() += 1;

            let mut searcher = Searcher::new();
            let path = entry.path().to_string_lossy().to_string();

            let _ = searcher.search_path(&matcher, entry.path(), UTF8(|line_num, line| {
                let mut m = matches.lock().unwrap();
                if m.len() >= max_results {
                    return Ok(false); // Stop searching this file
                }
                m.push(GrepMatch {
                    path: path.clone(),
                    line_number: line_num as u32,
                    line_content: line.trim_end().to_string(),
                    context_before: None,
                    context_after: None,
                });
                Ok(true)
            }));

            if matches.lock().unwrap().len() >= max_results {
                ignore::WalkState::Quit
            } else {
                ignore::WalkState::Continue
            }
        })
    });

    let final_matches = matches.lock().unwrap();
    let final_files = *files_searched.lock().unwrap();
    let truncated = final_matches.len() >= max_results;

    Ok(GrepResult {
        matches: final_matches.clone(),
        files_searched: final_files,
        truncated,
    })
}
