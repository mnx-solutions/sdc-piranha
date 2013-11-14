package test;

import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selenide.open;
import static com.codeborne.selenide.WebDriverRunner.getWebDriver;
import static com.codeborne.selenide.Selenide.*;
import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Selectors.*;

import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TestName;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.remote.RemoteWebDriver;

import pageobjects.CreateInstanceCarousel;
import pageobjects.ImageList;
import pageobjects.InstanceList;
import util.Common;
import util.SauceAuthentication;

import com.codeborne.selenide.SelenideElement;
import com.saucelabs.junit.SauceOnDemandTestWatcher;

public class ImageListTests {
	
	private ImageList imageList;

	private static final String BASE_URL = System.getProperty("endpoint");
	private static final int BASE_TIMEOUT = Integer.parseInt(System
			.getProperty("globaltimeout", "15000"));

	// SauceUutils
	// SauceAuthentication sa = new SauceAuthentication();
	// private static String sessionId;
	// private static WebDriver driver = getWebDriver();
	// public @Rule
	// TestName testName = new TestName();
	// public @Rule
	// SauceOnDemandTestWatcher resultReportingTestWatcher = new
	// SauceOnDemandTestWatcher(
	// this, sa.getAuthentication());
	//
	// @Override
	// public String getSessionId() {
	// return sessionId;
	// }
	//
	// @Before
	// public void setSessionId() {
	// sessionId = ((RemoteWebDriver) driver).getSessionId().toString();
	// }

	// SauceUtils
	@BeforeClass
	public static void openDashboard() {
		timeout = BASE_TIMEOUT;
		baseUrl = BASE_URL;
		open("/");
		Common.login();
	}

	@AfterClass
	public static void logout() {
		open("/landing/forgetToken");
	}
	
	@Before
	public void openImageList() {
		Common.clickNavigationLink("Compute");
		$(byText("List My Images")).click();
	}
	
	@Test
	public void checkImageListView() {
		Common.checkBreadcrumb("Compute/ Image List", "Create Instance");
		$(".item-list-container").shouldBe(visible);
	}

	@Test
	public void checkImageListItemDetails() {
		imageList = page(ImageList.class);
		$("#search").setValue("base");
		SelenideElement row = imageList.getImageByName("base","1.9.1");
		row.$(".status").click();
		row.$(".toolbox").shouldBe(visible);
		imageList.checkImageUuid(row, "60ed3a3e-92c7-11e2-ba4a-9b6d5feaa0c4");
		imageList.checkImageOs(row, "smartos");
		imageList.checkImageDescription(row, "A SmartOS image with just essential packages installed. Ideal for users who are comfortable with setting up their own environment and tools.");
		imageList.checkImageDatacenter(row, "us-west-1");
		imageList.checkImagePublicStatus(row, "true");
	}
}
