# Data sources and provenance

darkTimer ships a deliberately small local recipe catalog. Each row identifies
one source record in `public/data/recipes.json`, and the interface displays the
source, confidence classification, and associated agitation method.

## Included sources

| Source ID | Publisher | Publication | Use |
| --- | --- | --- | --- |
| `kodak-ed-bwf-2023-03` | Kodak | [Processing Black-and-White Films, ED-BWF, March 2023](https://www.kodakprofessional.com/sites/default/files/wysiwyg/pro/resources/edbwf_0.pdf) | Manually transcribed development time, temperature, dilution, and agitation facts |
| `ilford-fp4-plus-tech` | Ilford Photo | [FP4 Plus Technical Information](https://www.ilfordphoto.com/amfile/file/download/file/1919/product/689/) | Manually transcribed development time, temperature, dilution, and agitation facts |

Source URLs and retrieval dates are stored alongside the catalog. The source
publications are not copied into this repository and remain subject to their
owners' rights.

## Community reports

Original contributor test results may be added as `community-reported` recipes.
Their source record must use `kind: "community-contribution"`, link to the public
GitHub submission issue, state the chosen contributor credit, and record the
Apache-2.0 contribution basis. The recipe must include a positive
`successfulTests` count. Community reports are not relabeled as manufacturer
data, even when their values happen to match a publication.

## Excluded sources

The live 35mm.org integration and the former bulk developer catalogs are
disabled. Their licensing terms did not provide a sufficiently clear written
grant for the intended use. `PERMISSION_REQUESTS.md` contains draft requests
that can be sent before either source is reconsidered.

## Review procedure

For each proposed recipe, record the publisher, publication title, stable URL,
retrieval date, exact film, developer, dilution, temperature, time, format or
EI limits, and the agitation method assumed by the publication. Prefer current
manufacturer technical publications. Do not copy explanatory prose or tables.

For a community report, record the same processing facts plus the contributor's
chosen credit, test date, successful-test count, and explicit permission to
publish the result. Discord may be used for intake, but private messages and
private URLs must not be copied into the public issue.
