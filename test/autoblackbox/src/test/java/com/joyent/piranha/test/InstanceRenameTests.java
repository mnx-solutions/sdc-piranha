package com.joyent.piranha.test;

import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.pageobject.InstanceList;
import com.joyent.piranha.pageobject.Login;
import com.joyent.piranha.pageobject.NavBarMenu;
import com.joyent.piranha.pageobject.SideBarMenu;
import com.joyent.piranha.pageobject.instancedetails.InstanceDetails;
import com.joyent.piranha.util.TestWrapper;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.*;

public class InstanceRenameTests extends TestWrapper {

    public static final String USER_NAME = PropertyHolder.getTestUserLogin();
    public static final String PASSWORD = PropertyHolder.getTestUserPassword();
    public static NavBarMenu navBarMenu;
    public static SideBarMenu sideBarMenu;
    public static InstanceDetails instanceDetails;
    public static String TEST_INSTANCE_NAME = "dnd-forImageAutoTests";

    @BeforeClass
    public static void openDashboard() {
        timeout = BASE_TIMEOUT;
        baseUrl = BASE_URL;
        Login loginPage = open("/", Login.class);
        loginPage.login(USER_NAME, PASSWORD);
        navBarMenu = page(NavBarMenu.class);
        sideBarMenu = page(SideBarMenu.class);
        InstanceList instanceList = sideBarMenu.clickCompute().getInstanceList();
        instanceDetails = instanceList.openInstanceDetails(TEST_INSTANCE_NAME);
    }

    @AfterClass
    public static void logout() {
        navBarMenu.clickAccountMenu().clickLogout();
    }

    @Test
    public void renameInstanceValidation() {
        instanceDetails.getInstanceNameField().click();
        instanceDetails.getInstanceNameField().sendKeys("!!!");
        instanceDetails.waitForMediumSpinnerDisappear();
        $(byText("Machine name can contain only letters, digits and signs like '.' and '-'.")).shouldBe(visible);
        instanceDetails.getInstanceNameField().clear();
        instanceDetails.getInstanceNameField().sendKeys("dnd-forFIrewallAutoTests");
        $(byText("Machine name is already in use")).shouldBe(visible);
    }

    @Test
    public void renameInstance() {
        String instName = "NewInstName";
        instanceDetails.rename(instName);
        instanceDetails.getInstanceNameField().shouldHave(text(instName));
        sideBarMenu.clickCompute().getInstanceList().openInstanceDetails(instName);
        instanceDetails.rename(TEST_INSTANCE_NAME);
        instanceDetails.getInstanceNameField().shouldHave(text(TEST_INSTANCE_NAME));
    }
}