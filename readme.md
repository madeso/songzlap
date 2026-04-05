# Songzlap
Songzlap is a simple digital audio workstation (DAW) for the web.

# Features
* use the piano roll to create some samples. Select the instrument and lay out your tracks.
* create custom instruments
* import .mod files from your computer
* automatically save the current song in local storage
* export and import the song in the custom .song format
* export the song as wav
* change between if it's the current track or the whole song that is played
* loop mode feature: when enabled reaching the [end] position (configurable) the player automatically reset to a user the [start] position (configurable) of the current song/track (see previous point), when disabled it just starts at [start] and ends at [end]

# Design
- **Tailwind CSS** via CDN (with `forms` and `container-queries` plugins)
- **Fonts:** `Space Grotesk` (headers) + `Inter` (body/data) via Google Fonts
- **Icons:** Material Symbols Outlined (Google Fonts icon font)
- **Graphics:** Inline SVG for all engineering diagrams — no canvas, no third-party charting libs