package com.joyent.piranha.test;


import com.codeborne.selenide.SelenideElement;
import com.codeborne.selenide.WebDriverRunner;
import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.pageobject.*;
import com.joyent.piranha.util.TestWrapper;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.awt.*;
import java.io.IOException;

import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.*;

public class Manta extends TestWrapper {

    private static SideBarMenu sideBarMenu;
    private static String userName;
    private static FileManager fileManager;
    private static String fileName;
    private static final String TEST_FOLDER_NAME = "AllTestsHere";

    @BeforeClass
    public static void openDashboard() throws IOException {
        timeout = BASE_TIMEOUT;
        baseUrl = BASE_URL;
        fileName = PropertyHolder.getPublicKeyName().substring(1);
        Login loginPage = open("/", Login.class);
        userName = loginPage.createTestAccount(loginPage.clickSignUp());
        page(CreateAccountPage.class).clickCreateAcccount(Dashboard.class);
        page(Dashboard.class).getFreeTierWidget().shouldBe(visible);
        sideBarMenu = page(SideBarMenu.class);
        NavBarMenu navBarMenu = page(NavBarMenu.class);
        EditBillingInformation editBillingInformation = navBarMenu.clickAccountMenu().clickAccount().clickEditBilling();
        editBillingInformation.fillBillingInfoCorrectly();
        Account account = editBillingInformation.clickSaveChangesButton();
        account.clickButtonInModal("Ok");
        AccountSSH accountSSH = account.getSSHContainer();
        accountSSH.clickImportPublicKey();
        accountSSH.uploadFile(PropertyHolder.getPublicKeyPath());
        fileManager = sideBarMenu.clickFileManager();
        fileManager.createNewFolder(TEST_FOLDER_NAME);
    }

    @AfterClass
    public static void cleanUp() {
        $(byText(TEST_FOLDER_NAME)).click();
        fileManager.clickDelete();
        fileManager.clickButtonInModal("Yes");
    }

    @Test
    public void addFile() throws AWTException, IOException {
        fileManager = sideBarMenu.clickFileManager();
        fileManager.waitForMediumSpinnerDisappear();
        fileManager.selectFolder(TEST_FOLDER_NAME);
        SelenideElement file = $(byText(fileName));
        fileManager.uploadTestFile(userName, TEST_FOLDER_NAME);
        fileManager.waitForPageLoading();
        waitForFile(fileName, TEST_FOLDER_NAME);
        file.shouldBe(visible);
    }

    @Test
    public void createNewDirectory() {
        fileManager = sideBarMenu.clickFileManager();
        fileManager.selectFolder("public");
        fileManager.selectFolder(TEST_FOLDER_NAME);
        String folderName = "testFolder";
        fileManager.createNewFolder(folderName);
        fileManager.waitForMediumSpinnerDisappear();
        $(byText(folderName)).shouldBe(visible);
    }

    @Test
    public void checkButtons() throws IOException {
        fileManager = sideBarMenu.clickFileManager();
        fileManager.clickDownload();
        SelenideElement modal = $(".modal");
        modal.$(byText("No file selected.")).shouldBe(visible);
        fileManager.clickButtonInModal("Ok");
        fileManager.clickGetInfo();
        $("tbody").$(byText(TEST_FOLDER_NAME)).shouldBe(visible);
        fileManager.clickButtonInModal("Ok");
        fileManager.selectFolder(TEST_FOLDER_NAME);
        waitForFile(fileName, TEST_FOLDER_NAME);
        $(byText(fileName)).click();
        fileManager.clickGetInfo();
        modal.$(byText(fileName)).shouldBe(visible);
        fileManager.clickButtonInModal("Ok");
    }

    private void waitForFile(String fileName, String testFolderName) {
        WebDriverWait wait = new WebDriverWait(WebDriverRunner.getWebDriver(), 15);
        wait.until((WebDriver input) -> {
            fileManager.selectFolder("jobs");
            fileManager.selectFolder("public");
            if (!testFolderName.equals("")) {
                fileManager.selectFolder(testFolderName);
            }
            sleep(500);
            return $(byText(fileName)).isDisplayed();
        });
    }
}
