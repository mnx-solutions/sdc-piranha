package test;

import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.open;
import static com.codeborne.selenide.Selenide.page;
import static com.codeborne.selenide.Selenide.sleep;

import org.junit.After;
import org.junit.BeforeClass;
import org.junit.Test;
import org.junit.experimental.theories.Theory;
import org.junit.experimental.theories.DataPoints;
import org.junit.experimental.theories.Theories;
import org.junit.runner.RunWith;

import pageobjects.CreateInstanceCarousel;
import util.Common;
import data.*;

@RunWith(Theories.class)
public class CheckPackagesTests {
	private static final String BASE_URL = System.getProperty("endpoint");
	private static final int BASE_TIMEOUT = Integer.parseInt(System
			.getProperty("globaltimeout", "15000"));
	private CreateInstanceCarousel createInstanceCarousel;

	@DataPoints
	public static CreateInstanceObject[] data() {
		GenerateInstanceObjects gio = new GenerateInstanceObjects();
		return gio.getCioA();
	}

	@BeforeClass
	public static void openDashboard() {
		timeout = BASE_TIMEOUT;
		baseUrl = BASE_URL;
		open("/");
		Common.login();
		$(byText("Create Instance")).click();
	}

	@After
	public void goToStart() {
		$("#prev").click();
	}

	@Theory
	public void openCreateInstanceView(CreateInstanceObject cio) {
		String dataCenter = "us-west-1";
		Common.checkHeadingText("Create Instance");
		createInstanceCarousel = page(CreateInstanceCarousel.class);
		createInstanceCarousel.waitUntilPageIsActive(0);
		// createInstanceCarousel.selectZoneFilter(dataCenter);
		createInstanceCarousel.selectOsVersion(cio.getImageName(),
				cio.getImageVersion());
		createInstanceCarousel.selectOsImage(cio.getImageName());
		createInstanceCarousel.waitUntilPageIsActive(1);
		createInstanceCarousel.selectPackage(cio.getPackageDisplayedName());
		createInstanceCarousel.checkPaymentInfo(cio.getPrice(),
				cio.getPriceMonth());
		createInstanceCarousel
				.checkSelectedImageText(cio.getImageDescription());
	}
}