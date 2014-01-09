package test;

import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.open;
import static com.codeborne.selenide.Selenide.page;

import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;

import pageobjects.Common;
import pageobjects.ImageList;
import util.TestWrapper;

import com.codeborne.selenide.SelenideElement;

public class ImageListTests extends TestWrapper {

	private ImageList imageList;

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
		SelenideElement row = imageList.getImageByName("base", "1.9.1");
		row.$(".status").click();
		row.$(".toolbox").shouldBe(visible);
		imageList.checkImageUuid(row, "60ed3a3e-92c7-11e2-ba4a-9b6d5feaa0c4");
		imageList.checkImageOs(row, "smartos");
		imageList
				.checkImageDescription(
						row,
						"A SmartOS image with just essential packages installed. Ideal for users who are comfortable with setting up their own environment and tools.");
		imageList.checkImageDatacenter(row, "us-west-1");
		imageList.checkImagePublicStatus(row, "true");
	}
}
