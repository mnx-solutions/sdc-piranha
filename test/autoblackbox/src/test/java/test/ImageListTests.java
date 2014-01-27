package test;

import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.*;

import org.junit.*;

import pageobjects.Common;
import pageobjects.ImageList;
import util.TestWrapper;

import com.codeborne.selenide.SelenideElement;

import java.io.*;

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
        String name = "base"
                , version = "1.9.1"
                , uuid = "60ed3a3e-92c7-11e2-ba4a-9b6d5feaa0c4"
                , os = "smartos"
                , description = "A SmartOS image with just essential packages installed. Ideal for users who are comfortable with setting up their own environment and tools."
                , publicStatus = "true";
        if (System.getProperty("datacenter").equals("local-x")) {
            name = "testCreateImage";
            version = "1.0.0";
            uuid = "d5a68e5a-a500-6e95-caae-cbb34ce40a35";
            os = "smartos";
            description = "forTest";
            publicStatus = "false";
        }
        $("#search").setValue(name);
        SelenideElement row = imageList.getImageByName(name, version);
        row.$(".status").click();
        row.$(".toolbox").shouldBe(visible);
        imageList.checkImageUuid(row, uuid);
        imageList.checkImageOs(row, os);
        imageList.checkImageDescription(row, description);
        imageList.checkImageDatacenter(row, System.getProperty("datacenter"));
        imageList.checkImagePublicStatus(row, publicStatus);
    }

    @Test
    public void test() throws IOException {

        String imageID = "33c8a8c5-8ef7-e485-c5d4-dedf9c30b4bc";
        ProcessBuilder cloudApiAuth = new ProcessBuilder("ssh", "-i", System.getProperty("privateKeyPath"), "root@192.168.115.248", "curl", "-kis", "http://10.0.0.15/images/" + imageID, "-XDELETE");
        cloudApiAuth.start();
//        InputStream inputStream = process.getErrorStream();
//        String out = read(inputStream);
    }

//    private String read(InputStream inputStream) throws IOException {
//        BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream));
//        StringBuilder out = new StringBuilder();
//        String line;
//        while ((line = reader.readLine()) != null)
//        {
//            out.append(line).append("\n");
//        }
//        return out.toString();
//    }
}