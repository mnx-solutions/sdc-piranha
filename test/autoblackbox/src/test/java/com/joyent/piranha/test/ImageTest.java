package com.joyent.piranha.test;

import com.joyent.piranha.Common;
import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.pageobject.*;
import com.joyent.piranha.util.TestWrapper;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

import java.io.IOException;

import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selenide.open;
import static com.codeborne.selenide.Selenide.page;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class ImageTest extends TestWrapper {
    public static final String USER_NAME = PropertyHolder.getTestUserLogin();
    public static final String PASSWORD = PropertyHolder.getTestUserPassword();
    public static final String DATACENTER = PropertyHolder.getDatacenter(0);
    private static NavBarMenu navBarMenu;
    private static SideBarMenu sideBarMenu;

    @BeforeClass
    public static void openDashboard() {
        timeout = BASE_TIMEOUT;
        baseUrl = BASE_URL;
        Login login = open("/", Login.class);
        login.login(USER_NAME, PASSWORD);
        navBarMenu = page(NavBarMenu.class);
        sideBarMenu = page(SideBarMenu.class);
    }

    @AfterClass
    public static void logout() {
        navBarMenu.clickAccountMenu().clickLogout();
    }

    @Test
    public void imageCRUD() throws IOException {
        InstanceDetails instanceDetails = sideBarMenu.clickCompute().getInstanceList().openInstanceDetails(Common.getTestInstanceName());
        ImagesSection imagesSection = instanceDetails.openImagesSection();
        final String imageName = "testImage" + System.currentTimeMillis();
        imagesSection.setImageName(imageName);
        imagesSection.clickCreateImage();
        imagesSection.clickButtonInModal("Yes");
        imagesSection.waitForMediumSpinnerDisappear();
        imagesSection.clickButtonInModal("Ok");
        ImageList imageList = imagesSection.clickMyImagesList();
        imageList.checkTitle();
        assertTrue(imageList.isImageDisplayed(imageName));
        imageList.addGridColumn("Data Center");
        imageList.addGridColumn("Version");
        final String smartos = "smartos";
        imageList.checkImageParams(imageName, smartos, DATACENTER, "1.0.0");
        CreateInstance createInstance = imageList.clickCreateInstance(imageName);
        createInstance.checkTitle();
        sideBarMenu.clickImages();
        imageList.deleteImageByName(imageName);
        navBarMenu.clickAccountMenu().clickLogout();
        page(Login.class).login(USER_NAME, PASSWORD);
        imageList = sideBarMenu.clickImages();
        assertFalse(imageList.isImageDisplayed(imageName));
    }
}
