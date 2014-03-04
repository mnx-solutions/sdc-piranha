package test;

import static com.codeborne.selenide.Condition.exist;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.*;

import com.codeborne.selenide.ElementsCollection;
import org.junit.*;

import pageobjects.Common;
import pageobjects.ImageList;
import pageobjects.InstancePage;
import util.TestWrapper;

import com.codeborne.selenide.SelenideElement;

import java.io.IOException;

public class ImageTests extends TestWrapper {

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
    }

    @Test
    public void imageCRUD() throws IOException {
        InstancePage.gotoInstanceDetails(Common.getTestInstanceName());
        String imageName = ImageList.createTestImage();
        ImageList.gotoImageList();
        $(byText(imageName)).shouldBe(exist);
        Common.addGridColumn("Data Center");
        Common.addGridColumn("Version");
        ElementsCollection rows = $$("[data-ng-repeat=\"object in objects | orderBy:order | filter:matchesFilter\"]");
        SelenideElement row = Common.getRowByText(rows, imageName);
        row.$(byText("smartos")).shouldBe(visible);
        row.$(byText(System.getProperty("datacenter"))).shouldBe(visible);
        row.$(byText("1.0.0")).shouldBe(visible);
        row.$("button").click();
        $("#accordion2").shouldBe(visible);
        ImageList.gotoImageList();
        String imageId = ImageList.getImageUUID(imageName);
        ImageList.deleteImage(imageId);
        logout();
        Common.login();
        ImageList.gotoImageList();
        $(byText(imageName)).shouldNotBe(exist);
    }
}
