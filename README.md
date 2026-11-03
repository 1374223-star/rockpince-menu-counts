# Rockpince menu counts

Public numbers behind the `[1315]`-style product counts in the rockpince.hu menu.

- `category_counts.json`: `{"generated": "...", "counts": {categoryInnerId: [name, productCount, parentInnerId]}}`.
  A category's count = distinct visible products in it and in all of its subcategories.
- `category_counts.py`: read-only Shoprenter API counter (GET requests only).
- `.github/workflows/update-counts.yml`: runs every 3 hours and commits the JSON only when a number changed.
  It refuses to publish if the API returns suspiciously few categories/products.
- `menu_script.html`: the storefront script to paste into Shoprenter once. It loads
  `https://1374223-star.github.io/rockpince-menu-counts/category_counts.json (GitHub Pages)`.

Secrets needed (Settings → Secrets and variables → Actions): `SHOPRENTER_USERNAME`, `SHOPRENTER_PASSWORD`
(the same Shoprenter API login used by the product scripts).

Manual refresh: Actions → "Update category counts" → Run workflow.

Source of truth for the code: private repo `1374223-star/rockoff-upload`,
`src/webshop_changer/storefront/`.
