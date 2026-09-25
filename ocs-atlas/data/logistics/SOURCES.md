# Public logistics snapshots

These are adapted public directories, not an exhaustive facility inventory or an operational planning feed. No military-operated data service, installation access list, or restricted source is used. A publicly listed airport can be civil, private, military, or shared-use; OurAirports does not supply a reliable ownership/access field in this extract. The atlas does not classify permission to use it.

## OurAirports

- Publisher: https://ourairports.com/data/
- Data dictionary: https://ourairports.com/help/data-dictionary.html
- Airports: https://davidmegginson.github.io/ourairports-data/airports.csv
- Runways: https://davidmegginson.github.io/ourairports-data/runways.csv
- Rights: publisher releases the data to the public domain, without guarantees of accuracy or fitness for use.
- Transformation: retain directory identifier, name, country, type, coordinates, municipality, IATA/ICAO and scheduled-service flag; join longest runway whose source `closed` field is `0`. Blank lengths stay unknown. This does not establish runway suitability, cargo equipment, or current operations.
- All source airport types are retained. The default map selects large, medium and small airports; heliports, seaplane bases, balloonports and closed facilities are available through type filters. `ident` is a source identifier, not necessarily an ICAO code.

## UNECE UN/LOCODE

- Publisher and download: https://unlocode.unece.org/publications/
- Public pre-release archive: https://unlocode.unece.org/downloads/unlocode-latest.zip
- Source semantics: https://unlocode.unece.org/recommendation16/
- File layout: https://unlocode.unece.org/docs/data-attributes/
- Attribution: United Nations Economic Commission for Europe / UN/CEFACT, UN/LOCODE. The publisher states UN/CEFACT standards are free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Data have been adapted as described below; no endorsement is implied.
- This is the public **pre-release**, explicitly labeled throughout the atlas. The production-release archive returned HTTP 403 from its separate host during integration; no production-version claim is made. Retrieval time and SHA-256 are embedded in each snapshot. Individual `sourceDate` values remain the publisher's YYMM values; retrieval does not update those dates.
- Transformation: read three published code-list CSV parts, select function position 1 = `1` (maritime port) or position 8 = `8` (inland water port), omit rows marked `X` or status `XX` for deletion, deduplicate alternate-name entries by UN/LOCODE, retain name, country, functions, status, source date, remarks and coordinates. This includes provisional or unverified status codes, preserved in the detail panel. A location's function is a directory claim, not an independently verified operating port.
- Convert published degrees/minutes to decimal coordinates; no geocoding or precision enhancement. Invalid/missing coordinates remain null and are searchable/exportable but never plotted at country centroids. Country town/area codes are not individual berth or terminal inventories. No depth, terminal capacity, customs availability or cargo capability is inferred.

Refresh manually from the repository root with `python scripts/ocs-refresh-logistics.py`. Both source downloads and minimum-count/schema checks must pass before snapshots are replaced. This does not set up a recurring refresh. JSON exports retain source links, version, retrieval time, checksums and the current filters.
