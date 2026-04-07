from __future__ import annotations

import json
import unicodedata
from pathlib import Path
from urllib.request import urlopen

import pandas as pd


ROOT = Path(__file__).resolve().parent

URLS = {
    "usda_poverty": "https://www.ers.usda.gov/media/5496/poverty-estimates-for-the-united-states-states-and-counties-2023.csv?v=51650",
    "meric_cost_of_living": "https://meric.mo.gov/data/cost-living-data-series",
    "state_centroids": "https://developers.google.com/public-data/docs/canonical/states_csv",
    "us_counties_topojson": "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json",
    "us_states_topojson": "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json",
    "world_bank_life_expectancy": "https://api.worldbank.org/v2/country/all/indicator/SP.DYN.LE00.IN?format=json&per_page=20000",
    "world_countries_geojson": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson",
    "sao_paulo_municipalities": "https://raw.githubusercontent.com/mpjashby/crimemappingdata/main/inst/extdata/sao_paulo_muni.geojson",
    "sao_paulo_homicides": "https://raw.githubusercontent.com/mpjashby/crimemappingdata/main/inst/extdata/sao_paulo_homicides.xlsx",
}


def fetch_bytes(url: str) -> bytes:
    with urlopen(url, timeout=60) as response:
        return response.read()


def fetch_json(url: str):
    return json.loads(fetch_bytes(url).decode("utf-8"))


def normalize_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", str(value))
    without_diacritics = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return " ".join(without_diacritics.lower().strip().split())


def write_text_file(filename: str, contents: str) -> None:
    (ROOT / filename).write_text(contents, encoding="utf-8")


def build_us_county_poverty_csv() -> None:
    df = pd.read_csv(URLS["usda_poverty"], dtype={"FIPS_Code": str})
    df["FIPS_Code"] = df["FIPS_Code"].fillna("").astype(str).str.zfill(5)

    county_rows = df[df["FIPS_Code"].str.len() == 5].copy()
    wide = county_rows.pivot_table(
        index=["FIPS_Code", "Stabr", "Area_Name"],
        columns="Attribute",
        values="Value",
        aggfunc="first",
    ).reset_index()

    counties = wide[
        (wide["FIPS_Code"] != "00000")
        & (~wide["FIPS_Code"].str.endswith("000"))
    ].copy()

    output = counties.rename(
        columns={
            "FIPS_Code": "fips",
            "Stabr": "state_abbr",
            "Area_Name": "county_name",
            "PCTPOVALL_2023": "poverty_rate",
            "PCTPOV017_2023": "child_poverty_rate",
            "MEDHHINC_2023": "median_household_income",
        }
    )[
        [
            "fips",
            "state_abbr",
            "county_name",
            "poverty_rate",
            "child_poverty_rate",
            "median_household_income",
        ]
    ].sort_values(["state_abbr", "county_name"])

    output.to_csv(ROOT / "us_county_poverty_2023.csv", index=False)


def build_state_cost_of_living_csv() -> None:
    cost_table = pd.read_html(URLS["meric_cost_of_living"])[0]
    centroids = pd.read_html(URLS["state_centroids"])[0]

    cost_table = cost_table.rename(
        columns={
            "Rank": "cost_rank",
            "State": "state_name",
            "Index": "cost_index",
            "Grocery": "grocery_cost",
            "Housing": "housing_cost",
            "Utilities": "utilities_cost",
            "Transportation": "transportation_cost",
            "Health": "health_cost",
            "Misc.": "misc_cost",
        }
    )

    centroids = centroids.rename(
        columns={
            "state": "state_abbr",
            "name": "state_name",
        }
    )

    cost_table = cost_table[
        ~cost_table["state_name"].isin(["United States", "Puerto Rico"])
    ].copy()

    merged = cost_table.merge(
        centroids[["state_abbr", "state_name", "latitude", "longitude"]],
        on="state_name",
        how="inner",
    )

    merged["expensive_rank"] = merged["cost_index"].rank(method="first", ascending=False).astype(int)
    merged["is_top_ten_expensive"] = merged["expensive_rank"] <= 10

    output = merged[
        [
            "cost_rank",
            "expensive_rank",
            "state_name",
            "state_abbr",
            "cost_index",
            "grocery_cost",
            "housing_cost",
            "utilities_cost",
            "transportation_cost",
            "health_cost",
            "misc_cost",
            "latitude",
            "longitude",
            "is_top_ten_expensive",
        ]
    ].sort_values("expensive_rank")

    output.to_csv(ROOT / "state_cost_of_living_2025.csv", index=False)


def build_world_life_expectancy_csv(world_geojson: dict) -> None:
    valid_iso3 = {
        feature["properties"].get("ISO_A3")
        for feature in world_geojson["features"]
        if feature["properties"].get("ISO_A3") and feature["properties"].get("ISO_A3") != "-99"
    }

    world_bank_rows = fetch_json(URLS["world_bank_life_expectancy"])[1]
    records = []

    for row in world_bank_rows:
        if row["date"] != "2023" or row["value"] is None:
            continue
        iso3 = row["countryiso3code"]
        if iso3 not in valid_iso3:
            continue
        records.append(
            {
                "iso3": iso3,
                "country_name": row["country"]["value"],
                "life_expectancy": row["value"],
            }
        )

    output = pd.DataFrame(records).sort_values("country_name")
    output.to_csv(ROOT / "world_life_expectancy_2023.csv", index=False)


def build_sao_paulo_homicides_csv(geojson: dict) -> None:
    aliases = {
        "biritiba mirim": "biritiba-mirim",
        "embu das artes": "embu",
    }

    df = pd.read_excel(URLS["sao_paulo_homicides"])
    counts = (
        df.groupby("municipality")
        .size()
        .rename("homicide_incidents")
        .reset_index()
    )
    counts["municipality_key"] = counts["municipality"].map(normalize_name).replace(aliases)

    count_lookup = dict(zip(counts["municipality_key"], counts["homicide_incidents"]))
    records = []

    for feature in geojson["features"]:
        properties = feature["properties"]
        municipality_name = properties["name_muni"]
        municipality_key = normalize_name(municipality_name)
        municipality_code = int(properties["code_muni"])
        records.append(
            {
                "municipality_code": municipality_code,
                "municipality_name": municipality_name,
                "municipality_key": municipality_key,
                "homicide_incidents": int(count_lookup.get(municipality_key, 0)),
            }
        )

    output = pd.DataFrame(records).sort_values("municipality_name")
    output.to_csv(ROOT / "sao_paulo_municipal_homicides_2017_2022.csv", index=False)


def write_geography_files() -> tuple[dict, dict]:
    us_counties_bytes = fetch_bytes(URLS["us_counties_topojson"])
    us_states_bytes = fetch_bytes(URLS["us_states_topojson"])
    world_geojson_bytes = fetch_bytes(URLS["world_countries_geojson"])
    sao_paulo_geojson_bytes = fetch_bytes(URLS["sao_paulo_municipalities"])

    (ROOT / "us-counties-10m.json").write_bytes(us_counties_bytes)
    (ROOT / "us-states-10m.json").write_bytes(us_states_bytes)
    (ROOT / "world-countries.geojson").write_bytes(world_geojson_bytes)
    (ROOT / "sao_paulo_municipalities.geojson").write_bytes(sao_paulo_geojson_bytes)

    return (
        json.loads(world_geojson_bytes.decode("utf-8")),
        json.loads(sao_paulo_geojson_bytes.decode("utf-8")),
    )


def main() -> None:
    world_geojson, sao_paulo_geojson = write_geography_files()
    build_us_county_poverty_csv()
    build_state_cost_of_living_csv()
    build_world_life_expectancy_csv(world_geojson)
    build_sao_paulo_homicides_csv(sao_paulo_geojson)

    summary = [
        "Prepared A9 data files:",
        "- us_county_poverty_2023.csv",
        "- state_cost_of_living_2025.csv",
        "- world_life_expectancy_2023.csv",
        "- sao_paulo_municipal_homicides_2017_2022.csv",
        "- us-counties-10m.json",
        "- us-states-10m.json",
        "- world-countries.geojson",
        "- sao_paulo_municipalities.geojson",
    ]
    write_text_file("prepare_a9_data_output.txt", "\n".join(summary) + "\n")
    print("\n".join(summary))


if __name__ == "__main__":
    main()
