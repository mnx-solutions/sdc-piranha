package test;

import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.open;

import org.junit.*;

import pageobjects.Common;
import pageobjects.InstancePage;
import util.TestWrapper;

public class InstanceRenamingTests extends TestWrapper {

    @BeforeClass
    public static void openDashboard() {
        timeout = CHANGE_STATUS_TIMEOUT;
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
        InstancePage.viewInstanceDetails(Common.testInstanceName());
    }

    @Test
    public void renameInstanceValidation() {
        InstancePage.clickRenameInstanceIcon();
        InstancePage.instanceNameField().sendKeys("!!!");
        $(".loading-medium.wait-rename").waitWhile(visible, timeout);
        $(byText("Invalid machine name")).shouldBe(visible);
        InstancePage.instanceNameField().clear();
        InstancePage.instanceNameField().sendKeys("forFIrewallAutoTests");
        $(byText("Machine name is already in use")).shouldBe(visible);
    }

    @Test
    public void renameInstance() {
        String instName = "NewInstName";
        InstancePage.rename(instName);
        InstancePage.instanceNameField().shouldHave(text(instName));
        InstancePage.rename(Common.testInstanceName());
    }
}