import { storage } from "./storage";
import { detectNeighborhood, getMonthKey } from "./gpx";
import bcrypt from "bcryptjs";

const SAMPLE_ACTIVITIES = [
  {
    name: "Volta pel Raval",
    coordinates: [
      [2.1685, 41.3825], [2.1695, 41.3830], [2.1710, 41.3835],
      [2.1730, 41.3828], [2.1745, 41.3815], [2.1740, 41.3800],
      [2.1725, 41.3790], [2.1705, 41.3785], [2.1690, 41.3790],
      [2.1680, 41.3800], [2.1675, 41.3815], [2.1685, 41.3825],
    ],
    polygon: [
      [2.1685, 41.3825], [2.1695, 41.3830], [2.1710, 41.3835],
      [2.1730, 41.3828], [2.1745, 41.3815], [2.1740, 41.3800],
      [2.1725, 41.3790], [2.1705, 41.3785], [2.1690, 41.3790],
      [2.1680, 41.3800], [2.1675, 41.3815], [2.1685, 41.3825],
    ],
    areaSqMeters: 185000,
    distanceMeters: 3200,
  },
  {
    name: "Ruta Eixample Nord",
    coordinates: [
      [2.1550, 41.3920], [2.1580, 41.3940], [2.1620, 41.3950],
      [2.1660, 41.3945], [2.1690, 41.3930], [2.1680, 41.3910],
      [2.1650, 41.3900], [2.1610, 41.3895], [2.1570, 41.3900],
      [2.1550, 41.3920],
    ],
    polygon: [
      [2.1550, 41.3920], [2.1580, 41.3940], [2.1620, 41.3950],
      [2.1660, 41.3945], [2.1690, 41.3930], [2.1680, 41.3910],
      [2.1650, 41.3900], [2.1610, 41.3895], [2.1570, 41.3900],
      [2.1550, 41.3920],
    ],
    areaSqMeters: 220000,
    distanceMeters: 4100,
  },
  {
    name: "Circuit Barceloneta",
    coordinates: [
      [2.1870, 41.3810], [2.1890, 41.3800], [2.1920, 41.3785],
      [2.1940, 41.3770], [2.1930, 41.3755], [2.1900, 41.3745],
      [2.1870, 41.3750], [2.1850, 41.3765], [2.1845, 41.3785],
      [2.1860, 41.3800], [2.1870, 41.3810],
    ],
    polygon: [
      [2.1870, 41.3810], [2.1890, 41.3800], [2.1920, 41.3785],
      [2.1940, 41.3770], [2.1930, 41.3755], [2.1900, 41.3745],
      [2.1870, 41.3750], [2.1850, 41.3765], [2.1845, 41.3785],
      [2.1860, 41.3800], [2.1870, 41.3810],
    ],
    areaSqMeters: 145000,
    distanceMeters: 2800,
  },
  {
    name: "Gracia Gran Volta",
    coordinates: [
      [2.1530, 41.4010], [2.1560, 41.4030], [2.1600, 41.4045],
      [2.1640, 41.4050], [2.1680, 41.4040], [2.1700, 41.4020],
      [2.1690, 41.3995], [2.1660, 41.3980], [2.1620, 41.3975],
      [2.1580, 41.3980], [2.1550, 41.3995], [2.1530, 41.4010],
    ],
    polygon: [
      [2.1530, 41.4010], [2.1560, 41.4030], [2.1600, 41.4045],
      [2.1640, 41.4050], [2.1680, 41.4040], [2.1700, 41.4020],
      [2.1690, 41.3995], [2.1660, 41.3980], [2.1620, 41.3975],
      [2.1580, 41.3980], [2.1550, 41.3995], [2.1530, 41.4010],
    ],
    areaSqMeters: 310000,
    distanceMeters: 5200,
  },
  {
    name: "Montjuic Trail",
    coordinates: [
      [2.1500, 41.3680], [2.1520, 41.3700], [2.1550, 41.3720],
      [2.1590, 41.3730], [2.1630, 41.3725], [2.1650, 41.3705],
      [2.1640, 41.3680], [2.1610, 41.3660], [2.1570, 41.3650],
      [2.1530, 41.3655], [2.1510, 41.3670], [2.1500, 41.3680],
    ],
    polygon: [
      [2.1500, 41.3680], [2.1520, 41.3700], [2.1550, 41.3720],
      [2.1590, 41.3730], [2.1630, 41.3725], [2.1650, 41.3705],
      [2.1640, 41.3680], [2.1610, 41.3660], [2.1570, 41.3650],
      [2.1530, 41.3655], [2.1510, 41.3670], [2.1500, 41.3680],
    ],
    areaSqMeters: 275000,
    distanceMeters: 4600,
  },
  {
    name: "Diagonal Sprint",
    coordinates: [
      [2.1380, 41.3920], [2.1420, 41.3935], [2.1470, 41.3945],
      [2.1520, 41.3940], [2.1550, 41.3925], [2.1540, 41.3905],
      [2.1500, 41.3895], [2.1450, 41.3890], [2.1400, 41.3900],
      [2.1380, 41.3920],
    ],
    polygon: [
      [2.1380, 41.3920], [2.1420, 41.3935], [2.1470, 41.3945],
      [2.1520, 41.3940], [2.1550, 41.3925], [2.1540, 41.3905],
      [2.1500, 41.3895], [2.1450, 41.3890], [2.1400, 41.3900],
      [2.1380, 41.3920],
    ],
    areaSqMeters: 190000,
    distanceMeters: 3500,
  },
  {
    name: "Passeig de Gracia Loop",
    coordinates: [
      [2.1620, 41.3890], [2.1640, 41.3910], [2.1665, 41.3920],
      [2.1690, 41.3915], [2.1700, 41.3895], [2.1690, 41.3875],
      [2.1665, 41.3865], [2.1640, 41.3870], [2.1620, 41.3890],
    ],
    polygon: [
      [2.1620, 41.3890], [2.1640, 41.3910], [2.1665, 41.3920],
      [2.1690, 41.3915], [2.1700, 41.3895], [2.1690, 41.3875],
      [2.1665, 41.3865], [2.1640, 41.3870], [2.1620, 41.3890],
    ],
    areaSqMeters: 98000,
    distanceMeters: 2100,
  },
];

export async function seedDatabase() {
  try {
    const existing = await storage.getUserByEmail("runner1@paintrunbcn.com");
    if (existing) {
      console.log("[seed] Database already seeded, skipping.");
      return;
    }

    console.log("[seed] Seeding database with sample data...");

    const password = await bcrypt.hash("demo123", 10);
    const currentMonth = getMonthKey();
    const lastMonth = getMonthKey(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const user1 = await storage.createUser("runner1@paintrunbcn.com", "MaratonistaBCN", password);
    await storage.verifyUser("runner1@paintrunbcn.com");
    await storage.updatePaintColor(user1.id, "#FF6B35");

    const user2 = await storage.createUser("runner2@paintrunbcn.com", "CorredorUrba", password);
    await storage.verifyUser("runner2@paintrunbcn.com");
    await storage.updatePaintColor(user2.id, "#3182CE");

    const user3 = await storage.createUser("runner3@paintrunbcn.com", "TrailRunnerBCN", password);
    await storage.verifyUser("runner3@paintrunbcn.com");
    await storage.updatePaintColor(user3.id, "#38A169");

    const user4 = await storage.createUser("runner4@paintrunbcn.com", "PaintMaster", password);
    await storage.verifyUser("runner4@paintrunbcn.com");
    await storage.updatePaintColor(user4.id, "#D53F8C");

    for (const a of [SAMPLE_ACTIVITIES[0], SAMPLE_ACTIVITIES[1], SAMPLE_ACTIVITIES[3]]) {
      const neighborhood = detectNeighborhood(a.coordinates);
      await storage.createActivity(user1.id, a.name, a.coordinates, a.polygon, a.areaSqMeters, a.distanceMeters, neighborhood, currentMonth);
    }
    await storage.updateUserArea(user1.id);

    for (const a of [SAMPLE_ACTIVITIES[2], SAMPLE_ACTIVITIES[4]]) {
      const neighborhood = detectNeighborhood(a.coordinates);
      await storage.createActivity(user2.id, a.name, a.coordinates, a.polygon, a.areaSqMeters, a.distanceMeters, neighborhood, currentMonth);
    }
    await storage.updateUserArea(user2.id);

    for (const a of [SAMPLE_ACTIVITIES[5], SAMPLE_ACTIVITIES[6]]) {
      const neighborhood = detectNeighborhood(a.coordinates);
      await storage.createActivity(user3.id, a.name, a.coordinates, a.polygon, a.areaSqMeters, a.distanceMeters, neighborhood, currentMonth);
    }
    await storage.updateUserArea(user3.id);

    for (const a of [SAMPLE_ACTIVITIES[0]]) {
      const neighborhood = detectNeighborhood(a.coordinates);
      await storage.createActivity(user4.id, a.name, a.coordinates, a.polygon, a.areaSqMeters, a.distanceMeters, neighborhood, currentMonth);
    }
    await storage.updateUserArea(user4.id);

    const neighborhood0 = detectNeighborhood(SAMPLE_ACTIVITIES[0].coordinates);
    await storage.createActivity(user1.id, "Volta pel Raval (2a)", SAMPLE_ACTIVITIES[0].coordinates, SAMPLE_ACTIVITIES[0].polygon, SAMPLE_ACTIVITIES[0].areaSqMeters, SAMPLE_ACTIVITIES[0].distanceMeters, neighborhood0, currentMonth);
    await storage.updateUserArea(user1.id);

    await storage.createMonthlyTitle(user1.id, lastMonth, "global", null, 1, 500000);
    
    const sampleNeighborhood = neighborhood0 || "el Raval";
    await storage.createMonthlyTitle(user2.id, lastMonth, "neighborhood", sampleNeighborhood, 1, 200000);
    await storage.createMonthlyTitle(user3.id, lastMonth, "neighborhood", "la Dreta de l'Eixample", 1, 190000);

    await storage.followUser(user1.id, user2.id);
    await storage.followUser(user1.id, user3.id);
    await storage.followUser(user2.id, user1.id);
    await storage.followUser(user3.id, user1.id);
    await storage.followUser(user4.id, user1.id);

    console.log("[seed] Database seeded successfully!");
  } catch (error) {
    console.error("[seed] Error seeding database:", error);
  }
}
