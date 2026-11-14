-- AI Chat Assistant - MySQL export (structure + sample data: the user demo / demo1234 and 4 conversations)
-- Import: mysql -uroot -p < db_export.sql   (or phpMyAdmin > Import)

CREATE DATABASE IF NOT EXISTS chat_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE chat_db;

-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: chat_export
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `conversations`
--

DROP TABLE IF EXISTS `conversations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `conversations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(100) NOT NULL DEFAULT 'New chat',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `conversations_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=174 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `conversations`
--

LOCK TABLES `conversations` WRITE;
/*!40000 ALTER TABLE `conversations` DISABLE KEYS */;
INSERT INTO `conversations` VALUES (170,143,'Tell me a one-liner programming joke','2026-11-14 19:31:24','2026-11-14 19:31:29'),(171,143,'כתוב לי שיר קצר על קפה של בוקר','2026-11-14 19:31:31','2026-11-14 19:31:33'),(172,143,'מה מזג האוויר עכשיו בתל אביב?','2026-11-14 19:31:38','2026-11-14 19:31:52'),(173,143,'Draw a cozy seaside café at sunset','2026-11-14 19:32:06','2026-11-14 19:32:08');
/*!40000 ALTER TABLE `conversations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conversation_id` int NOT NULL,
  `role` enum('user','assistant') NOT NULL,
  `content` mediumtext NOT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `conversation_id` (`conversation_id`),
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1071 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messages`
--

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
INSERT INTO `messages` VALUES (1053,170,'user','Tell me a one-liner programming joke',NULL,'2026-11-14 19:31:24'),(1054,170,'assistant','Why do programmers prefer dark mode? Because light attracts bugs.',NULL,'2026-11-14 19:31:24'),(1055,170,'user','Still a one-liner, but change the subject',NULL,'2026-11-14 19:31:26'),(1056,170,'assistant','Why did the scarecrow get promoted? He was outstanding in his field.',NULL,'2026-11-14 19:31:26'),(1057,170,'user','Now write a tiny Python function that returns one of these jokes at random',NULL,'2026-11-14 19:31:29'),(1058,170,'assistant','```python\nimport random\n\ndef get_joke():\n    return random.choice([\n        \"Why do programmers prefer dark mode? Because light attracts bugs.\",\n        \"Why did the scarecrow get promoted? He was outstanding in his field.\"\n    ])\n```',NULL,'2026-11-14 19:31:29'),(1059,171,'user','כתוב לי שיר קצר על קפה של בוקר',NULL,'2026-11-14 19:31:31'),(1060,171,'assistant','עם אור ראשון והחלון נפתח,  \nריח הקפה בחדר פורח.  \nלוגמים לאט, היום כבר בא—  \nבוקר טוב, כוס של נחמה.',NULL,'2026-11-14 19:31:31'),(1061,171,'user','תן לשיר כותרת',NULL,'2026-11-14 19:31:33'),(1062,171,'assistant','**בוקר בכוס**',NULL,'2026-11-14 19:31:33'),(1063,172,'user','מה מזג האוויר עכשיו בתל אביב?',NULL,'2026-11-14 19:31:38'),(1064,172,'assistant','עכשיו בתל אביב **18°C**, מזג האוויר בהיר ברובו, הלחות **71%** והרוח קלה — כ־**3.5 קמ״ש**.',NULL,'2026-11-14 19:31:38'),(1065,172,'user','ומה צפוי בסוף השבוע? כדאי לתכנן יום בים?',NULL,'2026-11-14 19:31:52'),(1066,172,'assistant','בסוף השבוע, בשבת ובראשון, צפוי להיות נעים בתל אביב: **מעונן חלקית עד מעונן**, כ־**25–27 מעלות ביום**, וללא צפי ממשי לגשם. בהחלט אפשר לתכנן יום בים — רק כדאי לבדוק סמוך ליציאה את מצב הים והדגלים בחוף.',NULL,'2026-11-14 19:31:52'),(1067,173,'user','Draw a cozy seaside café at sunset',NULL,'2026-11-14 19:32:06'),(1068,173,'assistant','Here’s your cozy seaside café at sunset.','/uploads/bce80daa8a2d4c579bbe5f1287065499.webp','2026-11-14 19:32:06'),(1069,173,'user','What would be a good name for this café?',NULL,'2026-11-14 19:32:08'),(1070,173,'assistant','**The Golden Tide** — cozy, seaside, and perfect for a sunset café.',NULL,'2026-11-14 19:32:08');
/*!40000 ALTER TABLE `messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=144 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (143,'demo','$2b$12$q0S20UcRYbXrd6e0P5D60Og/Z02oTdFOvdcUVvRTtCrveBF.51EIe','2026-11-14 19:31:21');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed
