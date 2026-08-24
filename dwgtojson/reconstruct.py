import json
import matplotlib.pyplot as plt

# Load JSON
with open("building.json", "r") as f:
    data = json.load(f)

plt.figure(figsize=(12, 12))

for entity in data:

    entity_type = entity["type"]

    # ---------------- LINE ----------------
    if entity_type == "LINE":
        x = [entity["start"][0], entity["end"][0]]
        y = [entity["start"][1], entity["end"][1]]
        plt.plot(x, y, "k")

    # ---------------- LWPOLYLINE ----------------
    elif entity_type == "LWPOLYLINE":

        points = entity["points"]

        x = [p[0] for p in points]
        y = [p[1] for p in points]

        # Close the polyline if needed
        if len(points) > 2:
            x.append(points[0][0])
            y.append(points[0][1])

        plt.plot(x, y, "b")

plt.gca().set_aspect("equal")
plt.grid(True)

plt.title("Reconstructed Drawing")
plt.show()