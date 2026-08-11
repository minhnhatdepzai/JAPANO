-- JAPANO — ERD v2 (DDL MySQL/MariaDB) — schema chuẩn hoá.
DROP DATABASE IF EXISTS `japano_v2`;
CREATE DATABASE `japano_v2` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `japano_v2`;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE `Categories` (
  `CategoryID` BIGINT AUTO_INCREMENT,
  `CategoryName` VARCHAR(150) NOT NULL,
  `Kanji` VARCHAR(40),
  `Slug` VARCHAR(80) NOT NULL,
  `Description` VARCHAR(255),
  `ParentID` BIGINT,
  PRIMARY KEY (`CategoryID`),
  UNIQUE (`Slug`),
  FOREIGN KEY (`ParentID`) REFERENCES `Categories`(`CategoryID`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `Products` (
  `ProductID` BIGINT AUTO_INCREMENT,
  `CategoryID` BIGINT NOT NULL,
  `ProductName` VARCHAR(190) NOT NULL,
  `Kanji` VARCHAR(40),
  `Slug` VARCHAR(120) NOT NULL,
  `Brand` VARCHAR(80),
  `Price` BIGINT NOT NULL,
  `OldPrice` BIGINT,
  `Description` TEXT,
  `Story` TEXT,
  `Status` VARCHAR(20) NOT NULL,
  `CreatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`ProductID`),
  UNIQUE (`Slug`),
  CHECK (Price >= 0),
  FOREIGN KEY (`CategoryID`) REFERENCES `Categories`(`CategoryID`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE `Images` (
  `ImageID` BIGINT AUTO_INCREMENT,
  `ProductID` BIGINT NOT NULL,
  `Url` VARCHAR(500) NOT NULL,
  `Position` INT NOT NULL,
  PRIMARY KEY (`ImageID`),
  FOREIGN KEY (`ProductID`) REFERENCES `Products`(`ProductID`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `Colors` (
  `ColorID` BIGINT AUTO_INCREMENT,
  `ColorName` VARCHAR(60) NOT NULL,
  `ColorCode` VARCHAR(16),
  PRIMARY KEY (`ColorID`)
) ENGINE=InnoDB;

CREATE TABLE `Sizes` (
  `SizeID` BIGINT AUTO_INCREMENT,
  `SizeName` VARCHAR(20) NOT NULL,
  `SortOrder` INT NOT NULL,
  PRIMARY KEY (`SizeID`),
  UNIQUE (`SizeName`)
) ENGINE=InnoDB;

CREATE TABLE `ProductVariants` (
  `VariantID` BIGINT AUTO_INCREMENT,
  `ProductID` BIGINT NOT NULL,
  `ColorID` BIGINT NOT NULL,
  `SizeID` BIGINT NOT NULL,
  `SKU` VARCHAR(60) NOT NULL,
  `Price` BIGINT,
  `StockQuantity` INT NOT NULL,
  `Reserved` INT NOT NULL,
  `Status` VARCHAR(20) NOT NULL,
  PRIMARY KEY (`VariantID`),
  UNIQUE (`SKU`),
  UNIQUE (`ProductID`, `ColorID`, `SizeID`),
  CHECK (StockQuantity >= 0),
  CHECK (Reserved >= 0),
  FOREIGN KEY (`ProductID`) REFERENCES `Products`(`ProductID`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`ColorID`) REFERENCES `Colors`(`ColorID`) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`SizeID`) REFERENCES `Sizes`(`SizeID`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE `Users` (
  `UserID` BIGINT AUTO_INCREMENT,
  `FullName` VARCHAR(150) NOT NULL,
  `Email` VARCHAR(190),
  `PasswordHash` VARCHAR(255),
  `Phone` VARCHAR(40),
  `Role` VARCHAR(20) NOT NULL,
  `Status` VARCHAR(20) NOT NULL,
  `StripeCustomerID` VARCHAR(60),
  `ResetCodeHash` VARCHAR(64),
  `ResetCodeExpiresAt` DATETIME,
  `CreatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`UserID`),
  UNIQUE (`Email`)
) ENGINE=InnoDB;

CREATE TABLE `Addresses` (
  `AddressID` BIGINT AUTO_INCREMENT,
  `UserID` BIGINT NOT NULL,
  `RecipientName` VARCHAR(150) NOT NULL,
  `Phone` VARCHAR(40) NOT NULL,
  `Street` VARCHAR(255) NOT NULL,
  `Ward` VARCHAR(120),
  `Province` VARCHAR(120),
  `IsDefault` BOOLEAN NOT NULL,
  PRIMARY KEY (`AddressID`),
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `Profiles` (
  `ProfileID` BIGINT AUTO_INCREMENT,
  `UserID` BIGINT NOT NULL,
  `Gender` VARCHAR(30),
  `SkinTone` VARCHAR(60),
  `Styles` VARCHAR(255),
  `Occasion` VARCHAR(120),
  `Budget` BIGINT,
  `HeightCm` INT,
  `WeightKg` INT,
  `UsualSize` VARCHAR(20),
  `UpdatedAt` DATETIME,
  PRIMARY KEY (`ProfileID`),
  UNIQUE (`UserID`),
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `CartItems` (
  `CartID` BIGINT AUTO_INCREMENT,
  `UserID` BIGINT NOT NULL,
  `VariantID` BIGINT NOT NULL,
  `Quantity` INT NOT NULL,
  `AddedAt` DATETIME NOT NULL,
  PRIMARY KEY (`CartID`),
  UNIQUE (`UserID`, `VariantID`),
  CHECK (Quantity > 0),
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`VariantID`) REFERENCES `ProductVariants`(`VariantID`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `Wishlist` (
  `WishlistID` BIGINT AUTO_INCREMENT,
  `UserID` BIGINT NOT NULL,
  `ProductID` BIGINT NOT NULL,
  `CreatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`WishlistID`),
  UNIQUE (`UserID`, `ProductID`),
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`ProductID`) REFERENCES `Products`(`ProductID`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `Orders` (
  `OrderID` BIGINT AUTO_INCREMENT,
  `UserID` BIGINT,
  `DiscountID` BIGINT,
  `PaymentID` BIGINT,
  `OrderCode` VARCHAR(40) NOT NULL,
  `OrderDate` DATETIME NOT NULL,
  `OrderStatus` VARCHAR(30) NOT NULL,
  `RecipientName` VARCHAR(150) NOT NULL,
  `PhoneNumber` VARCHAR(40) NOT NULL,
  `ShippingAddress` VARCHAR(255) NOT NULL,
  `Subtotal` BIGINT NOT NULL,
  `DiscountAmount` BIGINT NOT NULL,
  `ShippingFee` BIGINT NOT NULL,
  `TotalAmount` BIGINT NOT NULL,
  `Source` VARCHAR(30),
  `CancelReason` VARCHAR(255),
  PRIMARY KEY (`OrderID`),
  UNIQUE (`OrderCode`),
  CHECK (TotalAmount >= 0),
  CHECK (DiscountAmount >= 0),
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (`DiscountID`) REFERENCES `DiscountCodes`(`DiscountID`) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (`PaymentID`) REFERENCES `Payments`(`PaymentID`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `OrderItems` (
  `OrderItemID` BIGINT AUTO_INCREMENT,
  `OrderID` BIGINT NOT NULL,
  `VariantID` BIGINT,
  `ProductName` VARCHAR(190) NOT NULL,
  `ColorName` VARCHAR(60),
  `SizeName` VARCHAR(20),
  `Quantity` INT NOT NULL,
  `UnitPrice` BIGINT NOT NULL,
  `LineTotal` BIGINT NOT NULL,
  PRIMARY KEY (`OrderItemID`),
  CHECK (Quantity > 0),
  FOREIGN KEY (`OrderID`) REFERENCES `Orders`(`OrderID`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`VariantID`) REFERENCES `ProductVariants`(`VariantID`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `Payments` (
  `PaymentID` BIGINT AUTO_INCREMENT,
  `PaymentMethod` VARCHAR(40) NOT NULL,
  `Provider` VARCHAR(20) NOT NULL,
  `PaymentStatus` VARCHAR(20) NOT NULL,
  `Amount` BIGINT NOT NULL,
  `Currency` VARCHAR(10) NOT NULL,
  `TransactionID` VARCHAR(120),
  `PaidAt` DATETIME,
  `CreatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`PaymentID`)
) ENGINE=InnoDB;

CREATE TABLE `DiscountCodes` (
  `DiscountID` BIGINT AUTO_INCREMENT,
  `Code` VARCHAR(40) NOT NULL,
  `DiscountType` VARCHAR(20) NOT NULL,
  `DiscountValue` INT NOT NULL,
  `MinOrderAmount` BIGINT NOT NULL,
  `MaxDiscountAmount` BIGINT,
  `UsageLimit` INT,
  `UsedCount` INT NOT NULL,
  `PerUserLimit` INT,
  `StartDate` DATETIME,
  `ExpiryDate` DATETIME,
  `Status` VARCHAR(20) NOT NULL,
  `CreatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`DiscountID`),
  UNIQUE (`Code`),
  CHECK (DiscountValue > 0),
  CHECK (UsedCount >= 0)
) ENGINE=InnoDB;

CREATE TABLE `VipMemberships` (
  `VipID` BIGINT AUTO_INCREMENT,
  `UserID` BIGINT NOT NULL,
  `QualifyingPeriod` CHAR(7) NOT NULL,
  `QualifiedSpend` BIGINT NOT NULL,
  `Threshold` BIGINT NOT NULL,
  `DiscountPercent` INT NOT NULL,
  `DiscountedUnits` INT NOT NULL,
  `Status` VARCHAR(20) NOT NULL,
  `StartedAt` DATETIME NOT NULL,
  `ExpiresAt` DATETIME NOT NULL,
  PRIMARY KEY (`VipID`),
  UNIQUE (`UserID`, `QualifyingPeriod`),
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `ReturnRequests` (
  `ReturnID` BIGINT AUTO_INCREMENT,
  `OrderID` BIGINT NOT NULL,
  `UserID` BIGINT,
  `PaymentID` BIGINT,
  `ReturnCode` VARCHAR(60) NOT NULL,
  `Kind` VARCHAR(10) NOT NULL,
  `ReturnStatus` VARCHAR(30) NOT NULL,
  `Reason` VARCHAR(255),
  `Note` TEXT,
  `Amount` BIGINT NOT NULL,
  `CodManualRefund` BOOLEAN NOT NULL,
  `RefundedAt` DATETIME,
  `CreatedAt` DATETIME NOT NULL,
  `UpdatedAt` DATETIME,
  PRIMARY KEY (`ReturnID`),
  UNIQUE (`ReturnCode`),
  FOREIGN KEY (`OrderID`) REFERENCES `Orders`(`OrderID`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (`PaymentID`) REFERENCES `Payments`(`PaymentID`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `ReturnImages` (
  `ReturnImageID` BIGINT AUTO_INCREMENT,
  `ReturnID` BIGINT NOT NULL,
  `Url` VARCHAR(500) NOT NULL,
  `Position` INT NOT NULL,
  PRIMARY KEY (`ReturnImageID`),
  FOREIGN KEY (`ReturnID`) REFERENCES `ReturnRequests`(`ReturnID`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `Reviews` (
  `ReviewID` BIGINT AUTO_INCREMENT,
  `ProductID` BIGINT NOT NULL,
  `UserID` BIGINT NOT NULL,
  `OrderID` BIGINT,
  `Rating` TINYINT NOT NULL,
  `Comment` TEXT,
  `MediaUrl` VARCHAR(500),
  `MediaKind` VARCHAR(10),
  `ReviewStatus` VARCHAR(20) NOT NULL,
  `ReviewDate` DATETIME NOT NULL,
  PRIMARY KEY (`ReviewID`),
  UNIQUE (`ProductID`, `UserID`, `OrderID`),
  CHECK (Rating BETWEEN 1 AND 5),
  FOREIGN KEY (`ProductID`) REFERENCES `Products`(`ProductID`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`OrderID`) REFERENCES `Orders`(`OrderID`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `ReviewReactions` (
  `ReactionID` BIGINT AUTO_INCREMENT,
  `ReviewID` BIGINT NOT NULL,
  `UserID` BIGINT NOT NULL,
  `Value` VARCHAR(20) NOT NULL,
  `CreatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`ReactionID`),
  UNIQUE (`ReviewID`, `UserID`),
  FOREIGN KEY (`ReviewID`) REFERENCES `Reviews`(`ReviewID`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `Interactions` (
  `InteractionID` BIGINT AUTO_INCREMENT,
  `UserID` BIGINT,
  `ProductID` BIGINT,
  `Type` VARCHAR(30) NOT NULL,
  `Value` INT NOT NULL,
  `Source` VARCHAR(30),
  `CreatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`InteractionID`),
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (`ProductID`) REFERENCES `Products`(`ProductID`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `AIChat` (
  `ChatID` BIGINT AUTO_INCREMENT,
  `UserID` BIGINT,
  `Content` TEXT,
  `IsClientSend` BOOLEAN NOT NULL,
  `CreatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`ChatID`),
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `AIDescriptions` (
  `DescriptionID` BIGINT AUTO_INCREMENT,
  `ProductID` BIGINT NOT NULL,
  `Headline` VARCHAR(255),
  `VisualSummary` TEXT,
  `StylingTip` TEXT,
  `PurchaseReason` TEXT,
  `Confidence` VARCHAR(10),
  `Engine` VARCHAR(60),
  `GeneratedAt` DATETIME NOT NULL,
  PRIMARY KEY (`DescriptionID`),
  UNIQUE (`ProductID`),
  FOREIGN KEY (`ProductID`) REFERENCES `Products`(`ProductID`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `TryOnHistory` (
  `TryOnID` BIGINT AUTO_INCREMENT,
  `UserID` BIGINT,
  `ProductID` BIGINT,
  `Engine` VARCHAR(190),
  `ResultUrl` VARCHAR(500),
  `CreatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`TryOnID`),
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (`ProductID`) REFERENCES `Products`(`ProductID`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `Goals` (
  `GoalID` BIGINT AUTO_INCREMENT,
  `UserID` BIGINT NOT NULL,
  `ProductID` BIGINT,
  `MonthlyIncome` BIGINT,
  `FixedExpenses` BIGINT,
  `CurrentSavings` BIGINT,
  `TargetMonths` INT,
  `MonthlySaving` BIGINT,
  `CreatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`GoalID`),
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`ProductID`) REFERENCES `Products`(`ProductID`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `Flagcards` (
  `FlagcardID` BIGINT AUTO_INCREMENT,
  `Slug` VARCHAR(80) NOT NULL,
  `Title` VARCHAR(190) NOT NULL,
  `Japanese` VARCHAR(190),
  `Region` VARCHAR(120),
  `Summary` TEXT,
  `SortOrder` INT,
  `Active` BOOLEAN NOT NULL,
  PRIMARY KEY (`FlagcardID`),
  UNIQUE (`Slug`)
) ENGINE=InnoDB;

CREATE TABLE `FlagcardCollections` (
  `CollectionID` BIGINT AUTO_INCREMENT,
  `UserID` BIGINT NOT NULL,
  `CompletedAt` DATETIME,
  `RewardVoucherCode` VARCHAR(40),
  `CreatedAt` DATETIME NOT NULL,
  `UpdatedAt` DATETIME,
  PRIMARY KEY (`CollectionID`),
  UNIQUE (`UserID`),
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `FlagcardAwards` (
  `AwardID` BIGINT AUTO_INCREMENT,
  `CollectionID` BIGINT NOT NULL,
  `FlagcardID` BIGINT,
  `OrderID` BIGINT,
  `AwardedAt` DATETIME NOT NULL,
  `Source` VARCHAR(40),
  PRIMARY KEY (`AwardID`),
  FOREIGN KEY (`CollectionID`) REFERENCES `FlagcardCollections`(`CollectionID`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`FlagcardID`) REFERENCES `Flagcards`(`FlagcardID`) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (`OrderID`) REFERENCES `Orders`(`OrderID`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `JapanSpotReviews` (
  `SpotReviewID` BIGINT AUTO_INCREMENT,
  `UserID` BIGINT,
  `Place` VARCHAR(190) NOT NULL,
  `Prefecture` VARCHAR(120) NOT NULL,
  `Rating` TINYINT NOT NULL,
  `Comment` TEXT,
  `MediaUrl` VARCHAR(500),
  `ReviewStatus` VARCHAR(20) NOT NULL,
  `CreatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`SpotReviewID`),
  CHECK (Rating BETWEEN 1 AND 5),
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `JapanSpotSuggestions` (
  `SuggestionID` BIGINT AUTO_INCREMENT,
  `UserID` BIGINT,
  `Prefecture` VARCHAR(120) NOT NULL,
  `Suggestion` TEXT,
  `CreatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`SuggestionID`),
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `Notifications` (
  `NotificationID` BIGINT AUTO_INCREMENT,
  `UserID` BIGINT,
  `Title` VARCHAR(255),
  `Content` TEXT,
  `Type` VARCHAR(60),
  `Action` VARCHAR(120),
  `IsRead` BOOLEAN NOT NULL,
  `CreatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`NotificationID`),
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `Banners` (
  `BannerID` BIGINT AUTO_INCREMENT,
  `Title` VARCHAR(190),
  `Image` VARCHAR(500),
  `Link` VARCHAR(255),
  `Active` BOOLEAN NOT NULL,
  `SortOrder` INT,
  PRIMARY KEY (`BannerID`)
) ENGINE=InnoDB;

CREATE TABLE `ShopSettings` (
  `SettingID` TINYINT,
  `ShopName` VARCHAR(150),
  `Hotline` VARCHAR(40),
  `Email` VARCHAR(150),
  `Address` VARCHAR(255),
  `ShipFee` BIGINT,
  `Cod` BOOLEAN,
  `Stripe` BOOLEAN,
  `Vnpay` BOOLEAN,
  `LogoUrl` VARCHAR(500),
  PRIMARY KEY (`SettingID`)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;