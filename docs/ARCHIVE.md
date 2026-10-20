# Archived files

This file lists legacy pages and duplicate images that were removed from the live site because nothing links to them. They are still in git history and can be restored at any time.

## How orphans were found

1. Build a link graph starting from the shared nav (`assets/js/top-bar.js`), the shared footer (`assets/js/bottom-bar.js`), and `index.html`. Then follow every local `href`/`src` breadth-first through each reachable page, stylesheet, and script. Links inside HTML comments do not count as live.
2. For every root `.html` page the graph never reaches, do a case-sensitive search of all tracked HTML, JS, CSS, PHP, and Markdown files for the filename. This includes absolute URLs.
3. For root-level images that also exist in `images/`, compare the two files byte for byte and search for every reference to the bare filename. Each reference is then resolved against the directory of the file that contains it, to see whether it points to the root copy or to the `images/` copy.

## Removed files

| Path                                                            | Evidence                                                                                                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Covid.html`                                                    | The link graph never reaches it, and no tracked file contains `Covid.html`. The only "Covid" match is plain text in `past-events.html`.                      |
| `og.html`                                                       | The link graph never reaches it, and no tracked file contains `og.html`. It is an old copy of the students page and is titled "Engineering Student Council". |
| `clubs2.html`                                                   | The link graph never reaches it, and the only file that mentions `clubs2` is the page itself. Its script, `assets/js/clubs2.js`, was kept (see below).       |
| `allocations.html`                                              | The link graph never reaches it, and no tracked file contains `allocations.html`. It is an old copy of the committees page and is titled "Our Committees".   |
| `old_ESC/` (whole folder, 159 tracked files including LFS zips) | No file outside `old_ESC/` mentions `old_ESC`. It is a self-contained copy of the previous site.                                                             |
| `Academics.jpg`                                                 | Identical to `images/Academics.jpg`. The only reference, in `old-home.html`, uses `images/Academics.jpg`.                                                    |
| `HEARTool.jpg`                                                  | Identical to `images/HEARTool.jpg`. The only reference, in `old-home.html`, uses `images/HEARTool.jpg`.                                                      |
| `image1.jpg`                                                    | Identical to `images/image1.jpg`. The only references are to `images/GalleryPhotos/image1.jpg`.                                                              |
| `vegetables.jpg`                                                | Identical to `images/vegetables.jpg`. The only reference, in `food.html`, uses `images/vegetables.jpg`.                                                      |
| `finance.jpeg`                                                  | Identical to `images/finance.jpeg`. The only reference, in `finance.html`, uses `images/finance.jpeg`.                                                       |
| `eweek2021.png`                                                 | Identical to `images/eweek2021.png`. Nothing references either copy.                                                                                         |
| `mentorship.png`                                                | Identical to `images/mentorship.png`. The only reference, in `old-home.html`, uses `images/mentorship.png`.                                                  |

After the removal, a link check over every remaining page found no new broken local references.

## Deliberately kept

| Path                                                       | Why it stays                                                                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `old-home.html`                                            | The tech lead preserved it on purpose.                                                                                                    |
| `google079f87068bf8c92f.html`                              | Google Search Console uses it for site verification.                                                                                      |
| `positive_vibes.html`                                      | `positive_messages.html`, which is reachable, links to it through the absolute URL `https://esc.berkeley.edu/positive_vibes.html`.        |
| `resources.html`                                           | `old-home.html` links to it, so removing it would break the kept page.                                                                    |
| `calfacilities.html`, `coefacilities.html`, `project.html` | Only links inside HTML comments point to them, in several live pages and the old nav. Someone may re-enable those links.                  |
| `assets/js/clubs2.js`                                      | Only the removed `clubs2.html` used it. It was kept because this cleanup only covers pages and duplicate images.                          |
| `top-bar.js` (root), `assets/top-bar.js`                   | These are old copies of the nav script, and no page loads them. They were left alone because the nav is being reworked on another branch. |

## Restoring a file

Every removal happened in a single commit titled "Archive orphaned legacy pages and duplicate root images". To bring a file back from the commit just before that one:

```sh
# Works even after the branch has been rebased or merged:
git checkout "$(git rev-list -n 1 HEAD -- <path>)^" -- <path>

# Examples
git checkout "$(git rev-list -n 1 HEAD -- Covid.html)^" -- Covid.html
git checkout "$(git rev-list -n 1 HEAD -- old_ESC)^" -- old_ESC
```

`old_ESC/` contains Git LFS files (`old_ESC/assets.zip`, `old_ESC/assets/img.zip`, `old_ESC/images.zip`). After restoring the folder, run `git lfs pull` to fetch their contents.
