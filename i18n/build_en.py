"""Builds assets/i18n/en.json for the shop's own English mode (owner 2026-11-16: phone visitors without Google
Translate saw everything in Hungarian). Category names are translated word by word from WORDS, with whole-name
overrides in PHRASES; UI strings come from UI. Run: python -X utf8 i18n/build_en.py <tree.json>"""
import json
import re
import sys
from pathlib import Path

WORDS = {
 "acél": "steel", "ajándéktárgyak": "gifts", "ajándékutalvány": "gift voucher", "akció": "sale", "akciós": "sale",
 "alsónemű": "underwear", "alsórészek": "bottoms", "alternativ": "alternative", "angyal": "angel", "angyalok": "angels",
 "arc": "face", "arcmaszk": "face mask", "bakancsfűzők": "boot laces", "bakancsok": "boots", "bakelitlemez": "vinyl",
 "belebújós": "pullover", "blazerek": "blazers", "blúzok": "blouses", "bodyk": "bodysuits", "bokacsizmák": "ankle boots",
 "bolerók": "boleros", "boszorkányok": "witches", "boxeralsó": "boxers", "bross": "brooch", "brossok": "brooches",
 "bútor": "furniture", "bőr": "leather", "bőrkabátok": "leather jackets", "bőrövek": "leather belts", "chokerek": "chokers",
 "cipzáras": "zip", "cipődíszek": "shoe charms", "cipők": "shoes", "cipőápolás": "shoe care", "combharisnyák": "thigh-high stockings",
 "combtáskák": "thigh bags", "csipkés": "lace", "csizmák": "boots", "csontváz": "skeleton", "csontvázak": "skeletons",
 "csuklópántok": "wristbands", "csuklószorító": "wristband", "csuklószorítók": "wristbands", "derékszorítók": "waist cinchers",
 "disztárgy": "decor & gifts", "dobozok": "boxes", "dzsekik": "jackets", "dísz": "decor", "egyéb": "other", "ernyők": "umbrellas",
 "esernyők": "umbrellas", "evőeszközök": "cutlery", "exkluzív": "exclusive", "fali": "wall", "fedőruhák": "cover-ups",
 "fegyveres": "weapon", "fej": "head", "fejdíszek": "headpieces", "feletti": "over", "felsők": "tops", "felsőruházat": "outerwear",
 "felvarrók": "patches", "figurák": "figures", "fém": "metal", "férfi": "men's", "fülbevalók": "earrings",
 "fürdőköpeny": "bathrobe", "fürdőruhák": "swimwear", "füstölőtartók": "incense holders", "fűzők": "corsets", "fűzős": "corset",
 "fűzőövek": "corset belts", "gitár": "guitar", "gitárpengetők": "guitar picks", "gyerek": "kids", "gyertya": "candle",
 "gyűrű": "ring", "gyűrűk": "rings", "gázmaszkok": "gas masks", "gázálarcok": "gas masks", "gótikus": "gothic",
 "hajcsatok": "hair clips", "hajdíszek": "hair accessories", "hajfesték": "hair dye", "hajhosszabbítások": "hair extensions",
 "hamutartók": "ashtrays", "hangjegy": "music note", "hangszer": "instrument", "harisnyakötők": "garters",
 "harisnyanadrágok": "tights", "harisnyatartók": "suspender belts", "harisnyák": "hosiery", "hevederek": "straps",
 "hosszú": "long", "huzat": "cover", "háborús": "war", "hálós": "mesh", "hámok": "harnesses", "hámtáskák": "harness bags",
 "hátfelvarrók": "back patches", "hátizsák": "backpack", "hátizsákok": "backpacks", "hózentróger": "suspenders",
 "hűtőmágnes": "fridge magnet", "ing": "shirt", "ingek": "shirts", "ivó": "drinkware", "játékok": "toys", "jelvény": "badge",
 "kabát": "coat", "kabátok": "coats", "kalap": "hat", "kalapok": "hats", "kapucni": "hood", "kapucnis": "hooded",
 "kardigánok": "cardigans", "karkiegészítők": "arm accessories", "karkötő": "bracelet", "karkötők": "bracelets",
 "karmelegítők": "arm warmers", "karom": "claw", "kaszás": "reaper", "kaszások": "reapers", "katonai": "military",
 "kelta": "celtic", "kendő": "bandana", "kendők": "bandanas", "kereszt": "cross", "kesztyű": "gloves", "kesztyűk": "gloves",
 "kiegészítők": "accessories", "kiltek": "kilts", "kisfelvarrók": "small patches", "kitűző": "pin badge", "koponya": "skull",
 "koponyák": "skulls", "kulcstartó": "keyring", "kulcstartók": "keyrings", "kártyák": "cards", "képkeret": "picture frame",
 "kézitáska": "handbag", "kézitáskák": "handbags", "köntös": "robe", "köpenyek": "cloaks", "kötött": "knitted",
 "lakat": "padlock", "lakásdekor": "home decor", "lakásdekoráció": "home decor", "leggingsek": "leggings",
 "legyezők": "fans", "lábszármelegítők": "leg warmers", "lámpák": "lamps", "lánchámok": "chain harnesses", "macskák": "cats",
 "magassarkú": "high heels", "magasszárú": "knee-high", "magyar": "hungarian", "maszkok": "masks", "matrica": "stickers",
 "medál": "pendant", "medálok": "pendants", "mell": "bust", "mellény": "vest", "mellények": "vests", "mintás": "designs",
 "mitológia": "mythology", "motoros": "biker", "mágnes": "magnet", "mécses": "tealight", "műbőr": "faux leather",
 "műszempillák": "false eyelashes", "nadrág": "trousers", "nadrágok": "trousers", "napszemüveg": "sunglasses",
 "napszemüvegek": "sunglasses", "nyakkendők": "ties", "nyakkiegészítők": "neck accessories", "nyaklánc": "necklace",
 "nyakláncok": "necklaces", "nyakpánt": "neck strap", "nyakörv": "collar", "nyakörvek": "collars", "nyári": "summer",
 "nélküli": "without", "női": "women's", "okkult": "occult", "oldallánc": "wallet chain", "otthoni": "home",
 "papír": "paper", "parókák": "wigs", "passztartó": "pass holder", "pelerinek": "capelets", "pentagramok": "pentagrams",
 "piercingek": "piercings", "pizsama": "pyjamas", "platformos": "platform", "poszter": "poster", "pulóver": "sweatshirt",
 "pulóverek": "sweatshirts", "pánt": "strap", "pántok": "straps", "pénztárca": "wallet", "pénztárcalánc": "wallet chain",
 "pénztárcák": "wallets", "pólók": "t-shirts", "rajzfilm": "cartoon", "rendszámtábla": "number plate", "ruhák": "dresses",
 "rövid": "short", "rövidnadrágok": "shorts", "sakk": "chess", "sapka": "cap", "sarkas": "heeled", "smink": "make-up",
 "soros": "row", "sportcipők": "sneakers", "szandálok": "sandals", "szegecs": "studs", "szobrok": "statues",
 "szoknyák": "skirts", "szárnyak": "wings", "szépségápolás": "beauty", "sál": "scarf", "sálak": "scarves", "sárkány": "dragon",
 "sárkányok": "dragons", "sárkányos": "dragon", "sétapálcák": "walking canes", "takaró": "blanket", "talpak": "soles",
 "talpbetétek": "insoles", "termékek": "products", "testhámok": "body harnesses", "tolltartó": "pencil case",
 "topok": "tops", "trikó": "tank top", "trikók": "tank tops", "tunikák": "tunics", "táska": "bag", "táskák": "bags",
 "téli": "winter", "törölköző": "towel", "tükrök": "mirrors", "tündér": "fairy", "tündérek": "fairies", "ujjatlan": "sleeveless",
 "ujjú": "sleeve", "utazótáskák": "travel bags", "utcai": "street", "vegán": "vegan", "videójáték": "video game",
 "viktoriánus": "victorian", "viselet": "wear", "vállkendők": "shrugs", "válltáska": "shoulder bag", "válltáskák": "shoulder bags",
 "vászontáska": "tote bag", "védőszemüvegek": "goggles", "zenekarok": "bands", "zenekaros": "band", "zokni": "socks",
 "zoknik": "socks", "zsabók": "jabots", "zászló": "flag", "ágytakaró": "bedspread", "álfültágítók": "fake plugs",
 "állat": "animal", "állatok": "animals", "állatos": "animal", "ápolási": "care", "ékszerek": "jewellery",
 "ékszeres": "jewellery", "és": "&", "írószer": "stationery", "órák": "clocks", "öv": "belt", "övcsat": "belt buckle",
 "övek": "belts", "övtáska": "waist bag", "övtáskák": "waist bags", "újdonság": "new", "újdonságok": "new arrivals",
 "ősmagyar": "ancient hungarian", "crop": "crop", "kesztyűk és karmelegítők": "gloves & arm warmers",
}
PHRASES = {   # whole names where word order or meaning needs care (lower case keys)
 "zenekaros": "Band merch", "zenekaros és egyéb ruhák": "Band merch & other clothing", "egyéb mintás": "Other designs",
 "újdonság / akció": "New / Sale", "újdonságok": "New arrivals", "akciós termékek": "On sale", "magyar zenekarok": "Hungarian bands",
 "alternativ ruhák": "Alternative clothing", "cipő / bakancs": "Shoes / Boots", "kiegészítők/ékszerek": "Accessories / Jewellery",
 "kapucni nélküli pulóver": "Sweatshirt (no hood)", "belebújós pulóver": "Pullover hoodie", "cipzáras pulóver": "Zip hoodie",
 "hosszú ujjú": "Long sleeve", "trikó / ujjatlan": "Tank top / Sleeveless", "mellény / kabát": "Vest / Jacket",
 "férfi / unisex": "Men's / Unisex", "film / rajzfilm / videójáték": "Film / Cartoon / Video game",
 "viking / military / motoros": "Viking / Military / Biker", "hangszer / sport": "Instrument / Sport",
 "sárkány / állat": "Dragon / Animal", "baseball sapka": "Baseball cap", "téli sapka": "Beanie", "kötött sapka / sál": "Beanie / Scarf",
 "kendő / bandana": "Bandana", "kesztyű / arcmaszk": "Gloves / Face mask", "boxeralsó / pizsama / köntös": "Boxers / Pyjamas / Robe",
 "mell feletti fűzők és fűzős felsők": "Overbust corsets & corset tops", "cipzáras kapucnis felsők és kardigánok": "Zip hoodies & cardigans",
 "crop topok és vállkendők": "Crop tops & shrugs", "fej- és nyakkiegészítők": "Head & neck accessories",
 "férfi fej- és nyakkiegészítők": "Men's head & neck accessories", "arc- és gázmaszkok": "Face & gas masks",
 "bőr / műbőr karkötők / csuklószorítók": "Leather / faux leather bracelets & wristbands", "jelvény / kitűző / bross": "Badges / Pins / Brooches",
 "medál / nyaklánc": "Pendants / Necklaces", "egyéb medálok / nyakláncok": "Other pendants / necklaces",
 "koponya / csontváz / kaszás medálok": "Skull / Skeleton / Reaper pendants", "koponyák / csontvázak / kaszások": "Skulls / Skeletons / Reapers",
 "gyertya-mécses-füstölőtartók / lámpák": "Candle, tealight & incense holders / Lamps", "ivó - és evőeszközök": "Drinkware & cutlery",
 "lakásdekoráció / képkeret / fali dísz": "Home decor / Frames / Wall decor", "kulcstartó / passztartó / lakat": "Keyrings / Pass holders / Padlocks",
 "fülbevalók / álfültágítók": "Earrings / Fake plugs", "gyűrű / karom": "Rings / Claws", "esernyők / sétapálcák": "Umbrellas / Walking canes",
 "maszkok / gázálarcok": "Masks / Gas masks", "csuklószorító / karkötő": "Wristbands / Bracelets", "oldallánc / pénztárcalánc": "Wallet chains",
 "bakancsfűzők és ápolási termékek": "Boot laces & care products", "bakancsok és csizmák": "Boots", "egy méret": "One size",
 "disztárgy": "Decor & Gifts", "egyéb": "Other", "felvarrók": "Patches", "egyéb kisfelvarrók": "Other small patches",
 "egyéb hátfelvarrók": "Other back patches", "zenekaros kisfelvarrók": "Band small patches", "zenekaros hátfelvarrók": "Band back patches",
 "acél,fém karkötők": "Steel / metal bracelets", "metal / punk / anarchy": "Metal / Punk / Anarchy", "spiral™ / dark / goth": "Spiral™ / Dark / Goth",
 "boszorkányok / okkult": "Witches / Occult", "gótikus / viktoriánus medálok": "Gothic / Victorian pendants",
 "kelta / viking medálok": "Celtic / Viking pendants", "gitár / hangjegy medálok": "Guitar / Music note pendants",
 "fegyveres / háborús medálok": "Weapon / War pendants", "angyal / tündér medálok": "Angel / Fairy pendants",
 "hajcsatok, hajdíszek": "Hair clips & accessories", "egyéb sapka": "Other hats", "cd / dvd / bakelitlemez": "CD / DVD / Vinyl",
 "3 soros": "3-row", "6 soros": "6-row", "8 soros": "8-row", "10 soros": "10-row", "15 soros": "15-row", "20 soros": "20-row", "cipődíszek, pántok": "Shoe charms & straps",
}
UI = {   # exact texts (trimmed). Upper-case variants are added automatically.
 "Főoldal": "Home", "Kezdőlap": "Home", "Kategóriák": "Categories", "Keresés": "Search", "Kosár": "Cart", "Kosárba": "Add to cart",
 "Belépés": "Sign in", "Regisztráció": "Register", "Kijelentkezés": "Sign out", "Fiókom": "My account",
 "Méret": "Size", "Válassz méretet": "Choose size", "Mennyiség:": "Quantity:", "Cikkszám:": "SKU:", "Megosztás": "Share",
 "Kívánságlistára teszem": "Add to wishlist", "Kedvencek": "Favourites", "Villámnézet": "Quick view", "Új termék": "New",
 "Hasonló termékek": "Similar products", "Ehhez ajánljuk": "Goes well with", "Akik már megvették ezeket a termékeket:": "People who bought these also bought:",
 "Erről a termékről még nem érkezett vélemény.": "No reviews for this product yet.", "Az Ön neve:": "Your name:", "Az Ön véleménye:": "Your review:",
 "Megjegyzés: A HTML-kód használata nem engedélyezett!": "Note: HTML is not allowed.", "Hiányzó adatok!": "Missing details!",
 "Kitűnő": "Excellent", "Mentés": "Save", "Küldd el egy barátodnak": "Send to a friend", "Kapható választék:": "Available:",
 "Rendezés:": "Sort by:", "Legtöbbet vásárolt": "Best sellers", "Elérhetőség, legújabb": "Newest first", "Gyártó, A - Z": "Brand, A - Z",
 "Gyártó, Z - A": "Brand, Z - A", "Kedvezmény mértéke szerint": "Biggest discount", "Ár szerint növekvő": "Price, low to high",
 "Ár szerint csökkenő": "Price, high to low", "Név szerint, A - Z": "Name, A - Z", "Név szerint, Z - A": "Name, Z - A",
 "Termék szűrés": "Filter products", "Ár": "Price", "Szűrés": "Filter", "Szűrők törlése": "Clear filters",
 "Keresés a termékismertetőkben": "Search in product descriptions", "Kövess minket!": "Follow us!", "Ügyfélszolgálat": "Customer service",
 "Információk": "Information", "Elérhetőségek": "Contact", "Címünk": "Our address", "Az üzletről": "About the store",
 "Üzletünk": "Our store", "Szállítás és fizetés": "Shipping & payment", "Hűségprogram": "Loyalty programme", "Kapcsolat": "Contact",
 "Képes tájékoztató": "Illustrated guide", "Adatkezelési tájékoztató": "Privacy policy", "Cookie tájékoztató": "Cookie policy",
 "Általános szerződési feltételek": "Terms & conditions", "Beállítások módosítása": "Change settings", "Elfogadom": "Accept",
 "Kedvezményes kínálatunk": "On sale", "Kínálatunkból véletlenszerűen": "Random picks", "Utoljára megtekintett termékek": "Recently viewed",
 "Összes újdonság": "All new arrivals", "Újdonságok megnézése": "See new arrivals", "Kérem a kupont": "Get my coupon",
 "Ingyenes": "Free", "INGYENES": "FREE", "Ingyenes szállítás 30 000 Ft felett": "Free shipping over 30 000 Ft",
 "30 000 Ft felett ingyenes": "Free over 30 000 Ft", "30 000 Ft felett ingyenes.": "Free over 30 000 Ft.",
 "Ingyenes személyes átvétel": "Free in-store pickup", "Ingyenes személyes átvétel budapesti boltunkban": "Free pickup in our Budapest store",
 "INGYENES KISZÁLLÍTÁS": "FREE DELIVERY", "Budapesten, a boltunkban: 1146 Dózsa György út 19.": "In our Budapest store: 1146 Dózsa György út 19.",
 "Hétfő–péntek 12–18, szombat 10–14": "Mon–Fri 12–18, Sat 10–14", "Hétfő–péntek 12–18, szombat 10–14, vasárnap zárva.": "Mon–Fri 12–18, Sat 10–14, closed Sunday.",
 "Hétfő – péntek": "Monday – Friday", "Hívható hétfőtől péntekig": "Call us Monday to Friday",
 "Belföldi szállítás": "Shipping within Hungary", "Külföldi szállítás (GLS)": "International shipping (GLS)",
 "Fizetési módok": "Payment methods", "Fizetés átvételkor": "Cash on delivery", "GLS futárszolgálat": "GLS courier",
 "MPL házhozszállítás": "MPL home delivery", "Bankszámla adatok": "Bank details", "Exkluzív": "Exclusive",
 "Angol és Európai import termékek": "English and European import products", "Fogyasztó Barát": "Fogyasztó Barát",
 "Csatlakozz hozzánk, és kezdj el RagnaRock Pontokat gyűjteni a következő rendeléseidhez!": "Join us and start collecting RagnaRock Points for your next orders!",
 "Kezdj el RagnaRock Pontokat gyűjteni a következő rendeléseidhez": "Start collecting RagnaRock Points for your next orders",
 "GYŰJTSD A PONTOKAT": "COLLECT POINTS", "GYŰJTSD A PONTOKAT!": "COLLECT POINTS!", "A következő rendelésedből": "Off your next order",
 "MAGYARORSZÁG LEGNAGYOBB ROCK ÉS ALTERNATIV RUHÁZATI WEBSHOPJA ÉS BOLTJA": "HUNGARY'S BIGGEST ROCK & ALTERNATIVE CLOTHING WEBSHOP AND STORE",
 "Budapesti üzletünkben:": "In our Budapest store:", "Budapest · XIV. kerület": "Budapest · District XIV",
 "Amennyiben a várható szállítási idő módosulna, értesítést küldünk a megadott e-mail címre.": "If the expected delivery time changes, we will email you.",
 "Házhozszállítás Magyarországon belül.": "Home delivery within Hungary.", "Magyarország": "Hungary",
 "Kiszállítási költség bruttó: 1850 Ft Magyarországon belül.": "Delivery: 1850 Ft within Hungary.",
 "Biztonságos fizetés bankkártyával, Apple Payjel vagy Google Payjel a rendelés leadásakor.": "Secure payment by card, Apple Pay or Google Pay when you order.",
 "Bankkártyával vagy készpénzzel, a csomag átvételekor.": "By card or cash when the parcel arrives.",
 "Kosárba teszem": "Add to cart", "Tovább a pénztárhoz": "Checkout", "Vásárlás folytatása": "Continue shopping",
 "Összesen:": "Total:", "Részösszeg:": "Subtotal:", "Szállítás:": "Shipping:", "Elfogyott": "Sold out", "Raktáron": "In stock",
 "Beszerzés alatt": "Being sourced", "Rendelhető": "Available to order", "Nincs készleten": "Out of stock",
 "Feliratkozás": "Subscribe", "Hírlevél": "Newsletter", "Vissza": "Back", "Tovább": "Next", "Mutass többet": "Show more",

 "Ajándéktárgyak": "Decor & Gifts", "Ruházat/Cipő": "Clothing / Shoes", "Kiegészítők/Ékszerek": "Accessories / Jewellery",
 "Újdonságok/Akciók": "New / Sale", "Mutass mást": "Show others", "Prémium minőség": "Premium quality",
 "Rendeld meg időben az ajándékokat, hogy karácsonyra megérkezzenek!": "Order your gifts in time for Christmas!",
 "Rólunk – RagnaRock webáruház": "About us – RagnaRock webshop", "Vasárnap": "Sunday", "Szombat": "Saturday", "Zárva": "Closed",
 "Webshopos rendelésedet itt ingyen átveheted.": "Pick up your webshop order here for free.",
 "Összes akciós termék": "All sale items", "Útvonaltervezés": "Directions", "Üzlet és átvevőhely": "Store & pickup point",
 "Biztonságos online bankkártyás fizetés (SimplePay)": "Secure online card payment (SimplePay)",
 "Minőség: első osztály, import": "Quality: first class, import", "Méret:": "Size:", "Mérettáblázat": "Size chart",
 "Szerezhető hűségpontok:": "Loyalty points you earn:", "Származási hely: EU": "Origin: EU", "Szélesség:": "Width:",
 "Hosszúság:": "Length:", "Értékelem a terméket": "Rate this product", "Írja meg véleményét!": "Write a review!",
 "Újdonságok": "New arrivals", "Akciók": "Sale", "Összes termék": "All products", "Tovább a termékhez": "View product",
 "Részletek": "Details", "Bezárás": "Close", "Fiók": "Account", "Kedvenceim": "My favourites", "Kosár tartalma": "Cart",
 "A kosár üres": "Your cart is empty", "A kosarad üres": "Your cart is empty", "Összes kategória": "All categories",
 "Ezzel a termékkel ingyenes a szállítás!": "Free shipping with this item!", "Átlagos értékelés:": "Average rating:",
 "Nem értékelt": "Not rated", "Értékelés:": "Rating:", "Rossz": "Poor", "Hossz:": "Length:", "Anyaga: 100% pamut": "Material: 100% cotton", "Anyaga:": "Material:", "Kínálatunk": "Our range", "KÍNÁLATUNK": "OUR RANGE", "Termékleírás": "Description", "Vélemények": "Reviews", "Leírás": "Description",
}
PNAME = [   # product-type words inside product names: [hungarian regex, english]
 ("cipzáras kapucnis pulóver", "zip hoodie"), ("kapucnis pulóver", "hoodie"), ("kapucni nélküli pulóver", "sweatshirt"),
 ("belebújós pulóver", "pullover hoodie"), ("pulóver", "sweatshirt"), ("hosszú ujjú póló", "long sleeve t-shirt"),
 ("unisex hosszú ujjú póló", "unisex long sleeve t-shirt"), ("női póló", "women's t-shirt"), ("férfi póló", "men's t-shirt"),
 ("gyerek póló", "kids t-shirt"), ("unisex póló", "unisex t-shirt"), ("női trikó", "women's tank top"), ("trikó", "tank top"),
 ("póló", "t-shirt"), ("kisfelvarró", "small patch"), ("hátfelvarró", "back patch"), ("szövött felvarró", "woven patch"),
 ("felvarró", "patch"), ("kitűző / fémjelvény", "pin badge"), ("kitűző szett", "pin badge set"), ("kitűző", "pin badge"),
 ("fémjelvény", "metal badge"), ("kulcstartó", "keyring"), ("bögre", "mug"), ("korsó", "tankard"), ("felespohár", "shot glass"),
 ("söröspohár", "beer glass"), ("pénztárca lánccal", "wallet with chain"), ("pénztárca", "wallet"), ("kötött sapka", "beanie"),
 ("baseball sapka", "baseball cap"), ("sapka", "cap"), ("gitárpengető szett", "guitar pick set"), ("gitárpengető", "guitar pick"),
 ("gitárszíj", "guitar strap"), ("hűtőmágnes", "fridge magnet"), ("tolltartó", "pencil case"), ("vászontáska", "tote bag"),
 ("kendő/bandana", "bandana"), ("frottír csuklószorító", "terry wristband"), ("csuklószorító", "wristband"),
 ("szilikon karkötő", "silicone wristband"), ("karkötő", "bracelet"), ("nyaklánc", "necklace"), ("acél medál", "steel pendant"),
 ("medál", "pendant"), ("fülbevaló", "earrings"), ("gyűrű", "ring"), ("keresztpántos táska", "crossbody bag"),
 ("oldaltáska", "shoulder bag"), ("hátizsák", "backpack"), ("táska", "bag"), ("rendszámtábla", "number plate"),
 ("fali dísz", "wall plaque"), ("mécsestartó", "candle holder"), ("lámpa", "lamp"), ("szobor", "statue"), ("zászló", "flag"),
 ("poszterzászló", "poster flag"), ("poszter", "poster"), ("neoprén maszk", "neoprene mask"), ("maszk", "mask"),
 ("ujjatlan farmering", "sleeveless denim shirt"), ("ing", "shirt"), ("kesztyű", "gloves"), ("zokni", "socks"), ("bakancs", "boots"),
 ("csizma", "boots"), ("cipő", "shoes"), ("db-os", "-piece"), ("ülőpárna", "seat cushion"), ("terepminta", "camo"),
 ("fehér mintás", "white pattern"), ("fekete mintás", "black pattern"), ("piros mintás", "red pattern"),
 ("asztali dísz", "table decoration"), ("rugdalózó", "baby romper"), ("övcsat", "belt buckle"), ("boxeralsó", "boxers"),
 ("fülbevaló/álfültágító", "earring / fake plug"), ("poháralátét", "coaster"), ("nadráglánc", "trouser chain"),
 ("női crop top", "women's crop top"), ("neoprén maszk", "neoprene mask"), ("wc-papír tartó", "toilet roll holder"),
 ("fekete", "black"), ("fehér", "white"), ("piros", "red"), ("olívazöld", "olive"), ("logó", "logo"),
]


def eng_name(name):
    key = " ".join(name.lower().split())
    if key in PHRASES:
        out = PHRASES[key]
    else:
        parts = re.split(r"(\s*/\s*|\s*,\s*|\s+|-)", key)
        out = "".join(WORDS.get(p, p) for p in parts)
        out = out[:1].upper() + out[1:]
    return out


def main():
    tree = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    cats = {}
    for v in tree.values():
        if v["status"] != "1" or v["parent"] == "19526":
            continue
        n = " ".join(v["name"].split())
        e = eng_name(n)
        if e.lower() != n.lower():
            cats[n] = e
    ui = dict(UI)
    out = {"exact": {}, "pname": [[a, b] for a, b in sorted(PNAME, key=lambda x: -len(x[0]))]}
    for d in (cats, ui):
        for k, v in d.items():
            out["exact"][k] = v
            out["exact"][k.upper()] = v.upper()
    left = sorted({w for n in cats for w in re.findall(r"[a-záéíóöőúüű]+", n.lower()) if w not in WORDS and re.search("[áéíóöőúüű]", w)})
    Path(__file__).resolve().parents[1].joinpath("assets", "i18n").mkdir(parents=True, exist_ok=True)
    Path(__file__).resolve().parents[1].joinpath("assets", "i18n", "en.json").write_text(
        json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(len(cats), "category names,", len(ui), "UI strings; untranslated words:", left)
    for n in list(cats)[:400]:
        print(f"  {n}  ->  {cats[n]}")


if __name__ == "__main__":
    main()
