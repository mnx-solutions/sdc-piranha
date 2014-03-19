package com.joyent.piranha.test;

import com.joyent.piranha.Common;
import com.joyent.piranha.pageobjects.InstancePage;
import com.joyent.piranha.util.TestWrapper;
import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;

import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.open;

public class InstanceRenameTests extends TestWrapper {

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
        InstancePage.gotoInstanceDetails(Common.getTestInstanceName());
    }

    @Test
    public void renameInstanceValidation() {
        InstancePage.clickRenameInstanceIcon();
        InstancePage.getInstanceNameField().sendKeys("!!!");
        $(".loading-medium.wait-rename").waitWhile(visible, timeout);
        $(byText("Machine name can contain only letters, digits and signs like '.' and '-'.")).shouldBe(visible);
        InstancePage.getInstanceNameField().clear();
        InstancePage.getInstanceNameField().sendKeys("forFIrewallAutoTests");
        $(byText("Machine name is already in use")).shouldBe(visible);
    }

    @Test
    public void renameInstance() {
        String instName = "NewInstName";
        InstancePage.rename(instName);
        InstancePage.getInstanceNameField().shouldHave(text(instName));
        InstancePage.rename(Common.getTestInstanceName());
    }
}