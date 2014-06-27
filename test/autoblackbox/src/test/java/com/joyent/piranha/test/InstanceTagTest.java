package com.joyent.piranha.test;

import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.pageobject.InstanceList;
import com.joyent.piranha.pageobject.Instances;
import com.joyent.piranha.pageobject.Login;
import com.joyent.piranha.pageobject.SideBarMenu;
import com.joyent.piranha.pageobject.instancedetails.InstanceDetails;
import com.joyent.piranha.pageobject.instancedetails.TagSection;
import com.joyent.piranha.util.TestWrapper;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;

import static com.codeborne.selenide.Condition.exist;
import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selenide.open;
import static com.codeborne.selenide.Selenide.page;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class InstanceTagTest extends TestWrapper {
    public static final String USER_NAME = PropertyHolder.getTestUserLogin();
    public static final String PASSWORD = PropertyHolder.getTestUserPassword();
    private static SideBarMenu sideBarMenu;

    @BeforeClass
    public static void openDashboard() {
        timeout = BASE_TIMEOUT;
        baseUrl = BASE_URL;
        Login loginPage = open("/", Login.class);
        loginPage.login(USER_NAME, PASSWORD);
        sideBarMenu = page(SideBarMenu.class);
    }

    @Before
    public void goToCompute() {
        sideBarMenu.clickCompute();
    }

    @Test
    public void tagOperationTest() {
        Instances instances = sideBarMenu.clickCompute();
        instances.checkTitle();
        InstanceList instanceList = instances.getInstanceList();
        instanceList.waitForInstanceList();
        String instanceName = instanceList.getFirstInstanceName();
        InstanceDetails instanceDetails = instanceList.openInstanceDetails(instanceName);
        instanceDetails.getPageTitle().shouldHave(text(instanceName));
        String key1 = "tagName1";
        String value1 = "tagValue1";
        TagSection tagSection = instanceDetails.openTagsSection();
        tagSection.addTag(key1, value1);
        String key2 = "tagName2";
        String value2 = "tagValue2";
        tagSection.addTag(key2, value2);
        tagSection.removeTag(key1);
        tagSection.getTagRepeaterByKey(key1).shouldNot(exist);
        tagSection.addTag(key1, value1);
        sideBarMenu.errorNotPresent();
        sideBarMenu.clickCompute();
        instances.addGridColumn("Tags");
        assertTrue(instances.isTagDisplayed(key1, value1));
        assertFalse(instances.isTagDisplayed("WrongKey", value1));
        assertFalse(instances.isTagDisplayed(key1, "WrongValue"));
        instanceList.openInstanceDetails(instanceName);
        instanceDetails.openTagsSection();
        tagSection.removeTag(key1);
        tagSection.removeTag(key2);
        assertFalse(instances.isTagDisplayed(key1, value1));
        assertFalse(instances.isTagDisplayed(key2, value2));
        sideBarMenu.errorNotPresent();
    }
}
