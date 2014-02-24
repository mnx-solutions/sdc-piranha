package test;

import static com.codeborne.selenide.Condition.exist;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.open;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;

import pageobjects.Common;
import pageobjects.InstanceList;
import pageobjects.InstancePage;
import util.TestWrapper;

public class InstanceTagsTests extends TestWrapper {

    @BeforeClass
    public static void openDashboard() {
        timeout = BASE_TIMEOUT;
        baseUrl = BASE_URL;
        open("/");
        Common.login();
    }

    @Before
    public void goToDashboard() {
        Common.clickNavigationLink("Compute");
    }

    @Test
    public void tagOpetationTests() {
        Common.checkHeadingText("Instances");
        InstanceList.waitForInstanceList();
        String instanceName = Common.getTestInstanceName();
        $(byText(instanceName)).click();
        Common.checkHeadingText(instanceName);
        InstancePage.openTagsSection();
        String key1 = "tagName1";
        String value1 = "tagValue1";
        InstancePage.addTag(key1, value1);
        String key2 = "tagName2";
        String value2 = "tagValue2";
        InstancePage.addTag(key2, value2);
        InstancePage.removeTag(key1);
        $(byText(key1)).shouldNot(exist);
        InstancePage.addTag(key1, value1);
        Common.errorNotPresent();
        Common.clickNavigationLink("Compute");
        Common.clickColumnsButton();
        Common.addGridColumn("Tags");
        assertTrue(InstancePage.isTagDisplayed(key1, value1));
        assertFalse(InstancePage.isTagDisplayed("WrongKey", value1));
        assertFalse(InstancePage.isTagDisplayed(key1, "WrongValue"));
        $(byText(instanceName)).click();
        InstancePage.openTagsSection();
        InstancePage.removeTag(key1);
        InstancePage.removeTag(key2);
        assertFalse(InstancePage.isTagDisplayed(key1, value1));
        assertFalse(InstancePage.isTagDisplayed(key2, value2));
        Common.errorNotPresent();
    }
}
