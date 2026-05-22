# Queries

## Comments

### "mtb" tag
```
way["mtb"]
```
is almost never used in Luxembourg.

## All ways with an MTB rating (s0 - s5)

```
[out:json][timeout:25];

// Find Luxembourg country boundary
area["ISO3166-1"="LU"][admin_level=2]->.lxb;

//way["mtb:scale"](area.lxb);
way["mtb:scale"]({{bbox}});

out body;
>;
out skel qt;
```

## All official MTB trails in Luxembourg

```
[out:json][timeout:25];

// Find Luxembourg country boundary
area["ISO3166-1"="LU"][admin_level=2]->.lxb;

relation["route"="mtb"](area.lxb);

out body;
>;
out skel qt;
```

## All official cycling paths (PC)

```
[out:json][timeout:25];

// Find Luxembourg country boundary
area["ISO3166-1"="LU"][admin_level=2]->.lxb;

relation["route"="bicycle"](area.lxb);

out body;
>;
out skel qt;
```

## Bike and family friendly paths (sketch)

```
[out:json][timeout:25];

// Using bbox
way({{bbox}})->.searchWays;

// Find Luxembourg country boundary
area["ISO3166-1"="LU"][admin_level=2]->.lxb;
//way(area.lxb)->.searchWays;

(
  // Dedicated cycleway
  way.searchWays["highway"="cycleway"];

  // There is some kind of cycleway included
  // Could also be a bike lane
  way.searchWays["cycleway"];

  // Segment that is specifically designed for bikes
  way.searchWays["bicycle"="designated"];

  // Residential street with speed limit
  way.searchWays["maxspeed"](if:t["maxspeed"] <= 30);
  
  // Walking path/track that is bike friendly
  // Not used often enough
  way.searchWays["bicycle"="yes"]["highway"~"path|track"];
);

out body;
>;
out skel qt;
```