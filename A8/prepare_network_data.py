from __future__ import annotations

import gzip
import json
from collections import defaultdict
from pathlib import Path
from urllib.request import urlretrieve

import networkx as nx


ROOT = Path(__file__).resolve().parent
KARATE_SOURCE = ROOT / "soc-karate" / "soc-karate.mtx"
SNAP_SOURCE = ROOT / "email-Eu-core-temporal-Dept3.txt.gz"
SNAP_URL = "https://snap.stanford.edu/data/email-Eu-core-temporal-Dept3.txt.gz"


def ensure_snap_download() -> None:
    if SNAP_SOURCE.exists():
        return
    print(f"Downloading {SNAP_URL}...")
    urlretrieve(SNAP_URL, SNAP_SOURCE)


def load_karate_graph() -> nx.Graph:
    graph = nx.Graph()
    with KARATE_SOURCE.open("r", encoding="utf-8") as handle:
        lines = [line.strip() for line in handle if line.strip()]

    size_line_index = next(i for i, line in enumerate(lines) if not line.startswith("%") and not line.startswith("%%"))
    node_count, _, _ = map(int, lines[size_line_index].split())

    graph.add_nodes_from(range(1, node_count + 1))
    for line in lines[size_line_index + 1 :]:
        source, target, *_ = map(int, line.split())
        if source != target:
            graph.add_edge(source, target, weight=1)

    return graph


def load_snap_department_graph() -> nx.Graph:
    ensure_snap_download()

    edge_weights: dict[tuple[int, int], int] = defaultdict(int)
    nodes: set[int] = set()

    with gzip.open(SNAP_SOURCE, "rt", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            source = int(parts[0])
            target = int(parts[1])
            if source == target:
                continue
            nodes.update((source, target))
            edge = tuple(sorted((source, target)))
            edge_weights[edge] += 1

    graph = nx.Graph()
    graph.add_nodes_from(sorted(nodes))
    for (source, target), weight in edge_weights.items():
        graph.add_edge(source, target, weight=weight)

    return graph


def assign_communities(graph: nx.Graph) -> dict[int, int]:
    communities = list(nx.algorithms.community.greedy_modularity_communities(graph, weight="weight"))
    ordered = sorted(communities, key=lambda members: (-len(members), min(members)))
    mapping: dict[int, int] = {}
    for community_id, members in enumerate(ordered, start=1):
        for node in members:
            mapping[node] = community_id
    return mapping


def graph_to_payload(
    graph: nx.Graph,
    *,
    dataset_id: str,
    title: str,
    subtitle: str,
    source_name: str,
    source_url: str,
    notes: str,
) -> dict:
    communities = assign_communities(graph)
    degree_lookup = dict(graph.degree())
    weighted_degree_lookup = dict(graph.degree(weight="weight"))

    ordered_nodes = sorted(
        graph.nodes(),
        key=lambda node: (
            communities[node],
            -degree_lookup[node],
            node,
        ),
    )

    nodes = [
        {
            "id": int(node),
            "label": f"Node {node}",
            "degree": int(degree_lookup[node]),
            "weightedDegree": float(weighted_degree_lookup[node]),
            "community": int(communities[node]),
            "matrixOrder": index,
        }
        for index, node in enumerate(ordered_nodes)
    ]

    links = [
        {
            "source": int(min(source, target)),
            "target": int(max(source, target)),
            "weight": float(data.get("weight", 1)),
        }
        for source, target, data in sorted(
            graph.edges(data=True),
            key=lambda edge: (communities[edge[0]], communities[edge[1]], edge[0], edge[1]),
        )
    ]

    community_sizes = defaultdict(int)
    for community in communities.values():
        community_sizes[community] += 1

    return {
        "datasetId": dataset_id,
        "title": title,
        "subtitle": subtitle,
        "sourceName": source_name,
        "sourceUrl": source_url,
        "notes": notes,
        "directed": False,
        "stats": {
            "nodeCount": graph.number_of_nodes(),
            "edgeCount": graph.number_of_edges(),
            "density": round(nx.density(graph), 4),
            "communityCount": len(community_sizes),
            "largestCommunitySize": max(community_sizes.values()),
        },
        "nodes": nodes,
        "links": links,
    }


def write_payload(filename: str, payload: dict) -> None:
    output_path = ROOT / filename
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {output_path}")


def main() -> None:
    karate_graph = load_karate_graph()
    write_payload(
        "karate_network.json",
        graph_to_payload(
            karate_graph,
            dataset_id="karate",
            title="Zachary Karate Club Network",
            subtitle="Friendship network of 34 karate club members",
            source_name="Network Repository: soc-karate",
            source_url="https://networkrepository.com/soc-karate.php",
            notes="Matrix Market source converted into an undirected network for force-directed and adjacency-matrix views.",
        ),
    )

    snap_graph = load_snap_department_graph()
    write_payload(
        "snap_email_department_network.json",
        graph_to_payload(
            snap_graph,
            dataset_id="snap-email-dept3",
            title="SNAP Email-Eu-Core Department 3 Network",
            subtitle="Department-level email interactions from the Stanford Large Network Dataset Collection",
            source_name="SNAP: email-Eu-core-temporal-Dept3",
            source_url="https://snap.stanford.edu/data/email-Eu-core-temporal.html",
            notes="Temporal emails were aggregated into a weighted undirected network so both visual encodings stay readable in a browser.",
        ),
    )


if __name__ == "__main__":
    main()
