# Site data: execs and opportunities

Some content changes every semester: who's on exec, which internships are open. Instead of hand-editing HTML, that content lives in JSON files under `data/`, and pages read it with a few lines of JavaScript. Each file has a **contract** in `schemas/` that spells out which fields exist and what they must look like. A checker runs on every PR, so a typo gets caught in review and never reaches the live site.

| Data                        | Edit this file            | Contract                            | Starting point                    |
| --------------------------- | ------------------------- | ----------------------------------- | --------------------------------- |
| Exec board and committees   | `data/execs.json`         | `schemas/execs.schema.json`         | `data/execs.example.json`         |
| Internships, research, etc. | `data/opportunities.json` | `schemas/opportunities.schema.json` | `data/opportunities.example.json` |

The example files are real, valid data (the exec example comes straight from the current `execs.html`). To get started, copy one:

```bash
cp data/execs.example.json data/execs.json
```

## Adding or editing an entry

1. Open the data file in VS Code. The `"$schema"` line at the top turns on autocomplete, and hovering over a field shows what it's for.
2. Copy an existing entry, paste it where you want it to appear (order in the file is order on the page), and edit it.
3. Run the check (see below) and fix anything it reports.
4. Commit and open a PR as usual (see [CONTRIBUTING.md](../CONTRIBUTING.md)).

### Exec member fields

| Field            | Required | Example                                   | Notes                                                                     |
| ---------------- | -------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| `id`             | yes      | `"evan-wong"`                             | Unique, lowercase, hyphens only. Handy for `#evan-wong` links.            |
| `name`           | yes      | `"Evan Wong"`                             |                                                                           |
| `role`           | yes      | `"Co-President"`                          | Shown exactly as written.                                                 |
| `email`          | yes      | `"president@esc.studentorg.berkeley.edu"` | Must be a berkeley.edu address. Co-holders of a role can share a mailbox. |
| `committee`      |          | `"finance"`                               | Must match an `id` in the `committees` list.                              |
| `headshot`       |          | `"exec2025/Evan.JPG"`                     | Path from the site root. **Capitalization must match the file exactly.**  |
| `pronouns`       |          | `"he/him"`                                |                                                                           |
| `major`          |          | `"EECS"`                                  |                                                                           |
| `graduationYear` |          | `2027`                                    | A number, no quotes. Unlike "3rd year", it doesn't go stale.              |
| `bio`            |          | `"Builds robots..."`                      | Plain text, up to 600 characters.                                         |
| `linkedin`       |          | `"https://www.linkedin.com/in/evan"`      | Full profile URL.                                                         |

The file also has a `term` (`"2025-2026"`) and a `committees` list (`id`, `name`, `description`, optional `url`).

### Opportunity fields

| Field          | Required | Example                          | Notes                                                                                                 |
| -------------- | -------- | -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `id`           | yes      | `"urap-spring-2027"`             | Unique, lowercase, hyphens only.                                                                      |
| `title`        | yes      | `"Big Ideas Contest"`            |                                                                                                       |
| `organization` | yes      | `"Blum Center"`                  |                                                                                                       |
| `type`         | yes      | `"research"`                     | One of `internship`, `research`, `scholarship`, `fellowship`, `event`, `job`, `competition`, `other`. |
| `url`          | yes      | `"https://urap.berkeley.edu/"`   | Must start with `https://`.                                                                           |
| `deadline`     |          | `"2027-01-20"`                   | `YYYY-MM-DD`. Leave it out for rolling deadlines.                                                     |
| `eventDate`    |          | `"2027-02-22"`                   | For events.                                                                                           |
| `postedDate`   |          | `"2026-10-01"`                   | Lets the page show "new" badges.                                                                      |
| `description`  |          |                                  | Plain text, up to 1000 characters.                                                                    |
| `eligibility`  |          | `"Undergraduates in any major."` |                                                                                                       |
| `location`     |          | `"Remote"`                       |                                                                                                       |
| `paid`         |          | `true`                           | No quotes.                                                                                            |
| `tags`         |          | `["eecs", "summer"]`             | Lowercase, hyphens only.                                                                              |
| `contact`      |          | `{ "email": "..." }`             | `email` is required, `name` is optional.                                                              |

For the full rules, read the schema files. Every field has a `description`.

## Running the check

```bash
npm run check:data
```

It checks every `data/<name>.json` and `data/<name>.example.json` against `schemas/<name>.schema.json`, plus a few things a schema can't express:

- **Errors** (CI fails): missing or misspelled fields, wrong types, impossible dates like `2027-02-30`, duplicate `id`s, an exec pointing at a committee that doesn't exist, a deadline before its posted date, and **image paths that don't exist or have the wrong capitalization**.
- **Warnings** (CI still passes): opportunities whose deadline has passed, two execs with the same photo, duplicate links.

Every problem tells you the file, the field, and how to fix it:

```text
✖ data/execs.json
    error   members[1].headshot: "exec2025/Evan.jpg" does not match the file's capitalization ("exec2025/Evan.JPG")
            fix: Change it to "exec2025/Evan.JPG". macOS ignores capitalization, but the Linux web server treats them as different files, so the image would 404 on the live site.
```

> **Why the fuss about capitalization?** Macs treat `Evan.jpg` and `Evan.JPG` as the same file, so the photo looks fine when you test locally. The OCF server runs Linux, where they're two different files, and visitors see a broken image. The checker catches this before it ships.

## Rendering the data on a page

A page fetches the JSON and builds elements with it. Use `textContent` (never `innerHTML`) for anything that came from the data. That way a stray `<` in a bio can't break the page or inject markup.

```html
<div id="exec-grid"></div>
<script type="module">
  const grid = document.getElementById('exec-grid');

  try {
    const res = await fetch('data/execs.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { members } = await res.json();

    for (const m of members) {
      const card = document.createElement('article');
      card.className = 'officer';
      card.id = m.id;

      if (m.headshot) {
        const img = document.createElement('img');
        img.src = m.headshot;
        img.alt = m.name;
        img.loading = 'lazy';
        card.append(img);
      }

      const name = document.createElement('h3');
      name.textContent = m.name;

      const role = document.createElement('p');
      role.className = 'position';
      role.textContent = m.role;

      const email = document.createElement('a');
      email.href = `mailto:${m.email}`;
      email.textContent = m.email;

      card.append(name, role, email);
      grid.append(card);
    }
  } catch (err) {
    grid.textContent = 'Could not load the executive board. Please try again later.';
    console.error(err);
  }
</script>
```

Opportunities work the same way: fetch `data/opportunities.json`, then filter by `type` or `tags`. You can hide expired entries with `o.deadline >= new Date().toISOString().slice(0, 10)`.

## Changing a contract

Need a new field? Add it to the schema, with a `description`, in the same PR that starts using it, and update the example file. Run `npm test` and `npm run check:data`. Adding an optional field never breaks existing data. Making a field required, or renaming one, means updating every data file in the same PR.
